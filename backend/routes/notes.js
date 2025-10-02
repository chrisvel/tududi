const express = require("express");
const { Note, Tag, Project } = require("../models");
const { extractUidFromSlug } = require("../utils/slug-utils");
const { validateTagName } = require("../services/tagsService");
const router = express.Router();
const permissionsService = require("../services/permissionsService");
const { hasAccess } = require("../middleware/authorize");
const _ = require("lodash");
const { logError } = require("../services/logService");

// Helper function to update note tags
async function updateNoteTags(note, tagsArray, userId) {
    if (_.isEmpty(tagsArray)) {
        await note.setTags([]);
        return;
    }

    try {
        // Validate and filter tag names
        const validTagNames = [];
        const invalidTags = [];

        for (const name of tagsArray) {
            const validation = validateTagName(name);
            if (validation.valid) {
                // Check for duplicates
                if (!validTagNames.includes(validation.name)) {
                    validTagNames.push(validation.name);
                }
            } else {
                invalidTags.push({ name, error: validation.error });
            }
        }

        if (invalidTags.length > 0) {
            throw new Error(
                `Invalid tag names: ${invalidTags.map((t) => `"${t.name}" (${t.error})`).join(", ")}`
            );
        }

        const tags = await Promise.all(
            validTagNames.map(async (name) => {
                const [tag] = await Tag.findOrCreate({
                    where: { name, user_id: userId },
                    defaults: { name, user_id: userId }
                });
                return tag;
            })
        );
        await note.setTags(tags);
    } catch (error) {
        logError("Failed to update tags:", error.message);
        throw error; // Re-throw to handle at route level
    }
}

// GET /api/notes
router.get("/notes", async (req, res) => {
    try {
        const orderBy = req.query.order_by || "title:asc";
        const [orderColumn, orderDirection] = orderBy.split(":");

        const whereClause = await permissionsService.ownershipOrPermissionWhere(
            "note",
            req.session.userId
        );
        let includeClause = [
            {
                model: Tag,
                attributes: ["name", "uid"],
                through: { attributes: [] }
            },
            {
                model: Project,
                required: false,
                attributes: ["name", "uid"]
            }
        ];

        // Filter by tag
        if (req.query.tag) {
            includeClause[0].where = { name: req.query.tag };
            includeClause[0].required = true;
        }

        const notes = await Note.findAll({
            where: whereClause,
            include: includeClause,
            order: [[orderColumn, orderDirection.toUpperCase()]],
            distinct: true
        });

        res.json(notes);
    } catch (error) {
        logError("Error fetching notes:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/note/:uidSlug",
    hasAccess(
        "ro",
        "note",
        async (req) => {
            return extractUidFromSlug(req.params.uidSlug);
        },
        { notFoundMessage: "Note not found." }
    ),
    async (req, res) => {
        try {
            const note = await Note.findOne({
                where: { uid: extractUidFromSlug(req.params.uidSlug) },
                include: [
                    {
                        model: Tag,
                        attributes: ["name", "uid"],
                        through: { attributes: [] }
                    },
                    {
                        model: Project,
                        required: false,
                        attributes: ["name", "uid"]
                    }
                ]
            });

            res.json(note);
        } catch (error) {
            logError("Error fetching note:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// POST /api/note
router.post("/note",
    hasAccess(
        "rw",
        "project",
        async (req) => {
            const { project_uid } = req.body;
            if (!project_uid || _.isEmpty(project_uid.toString().trim())) {
                return null;
            }
            return project_uid.toString().trim();
        },
        { notFoundMessage: "Note project not found" }
    ),
    async (req, res) => {
        try {
            const { title, content, project_uid, tags } = req.body;

            const noteAttributes = {
                title,
                content,
                user_id: req.session.userId
            };

            // project_uid is already validated by hasAccess middleware
            const project = await Project.findOne({
                where: { uid: project_uid.toString().trim() }
            });

            noteAttributes.project_id = project.id;

            const note = await Note.create(noteAttributes);

            // Handle tags - can be an array of strings
            // or array of objects with name property
            let tagNames = [];
            if (Array.isArray(tags)) {
                if (tags.every((t) => typeof t === "string")) {
                    tagNames = tags;
                } else if (tags.every((t) => typeof t === "object" && t.name)) {
                    tagNames = tags.map((t) => t.name);
                }
            }

            await updateNoteTags(note, tagNames, req.session.userId);

            // Reload note with associations
            const noteWithAssociations = await Note.findByPk(note.id, {
                include: [
                    {
                        model: Tag,
                        attributes: ["name", "uid"],
                        through: { attributes: [] }
                    },
                    {
                        model: Project,
                        required: false,
                        attributes: ["name", "uid"]
                    }
                ]
            });

            res.status(201).json({
                ...noteWithAssociations.toJSON(),
                uid: noteWithAssociations.uid
            });
        } catch (error) {
            logError("Error creating note:", error);
            res.status(400).json({
                error: "There was a problem creating the note.",
                details: error.errors
                    ? error.errors.map((e) => e.message)
                    : [error.message]
            });
        }
    });

router.patch(
    "/note/:uid",
    hasAccess(
        "rw",
        "note",
        async (req) => {
            return extractUidFromSlug(req.params.uid);
        },
        { notFoundMessage: "Note not found." }
    ),
    async (req, res) => {
        try {
            const note = await Note.findOne({
                where: { uid: req.params.uid }
            });

            const { title, content, project_uid, tags } = req.body;

            const updateData = {};
            if (title !== undefined) updateData.title = title;
            if (content !== undefined) updateData.content = content;

            // Handle project assignment
            if (project_uid !== undefined) {
                if (project_uid && typeof project_uid === 'string' && project_uid.trim()) {
                    const projectUidValue = project_uid.trim();
                    const project = await Project.findOne({
                        where: { uid: projectUidValue }
                    });
                    if (!project) {
                        return res
                            .status(400)
                            .json({ error: "Invalid project." });
                    }
                    const projectAccess = await permissionsService.getAccess(
                        req.session.userId,
                        "project",
                        project.uid
                    );
                    const isOwner = project.user_id === req.session.userId;
                    const canWrite =
                        isOwner ||
                        projectAccess === "rw" ||
                        projectAccess === "admin";
                    if (!canWrite) {
                        return res.status(403).json({ error: "Forbidden" });
                    }
                    updateData.project_id = project.id;
                } else {
                    updateData.project_id = null;
                }
            }

            await note.update(updateData);

            // Handle tags if provided
            if (tags !== undefined) {
                let tagNames = [];
                if (Array.isArray(tags)) {
                    if (tags.every((t) => typeof t === "string")) {
                        tagNames = tags;
                    } else if (
                        tags.every((t) => typeof t === "object" && t.name)
                    ) {
                        tagNames = tags.map((t) => t.name);
                    }
                }
                await updateNoteTags(note, tagNames, req.session.userId);
            }

            // Reload note with associations
            const noteWithAssociations = await Note.findByPk(note.id, {
                include: [
                    {
                        model: Tag,
                        attributes: ["id", "name", "uid"],
                        through: { attributes: [] }
                    },
                    {
                        model: Project,
                        required: false,
                        attributes: ["id", "name", "uid"]
                    }
                ]
            });

            res.json(noteWithAssociations);
        } catch (error) {
            logError("Error updating note:", error);
            res.status(400).json({
                error: "There was a problem updating the note.",
                details: error.errors
                    ? error.errors.map((e) => e.message)
                    : [error.message]
            });
        }
    }
);

router.delete(
    "/note/:uid",
    hasAccess(
        "rw",
        "note",
        async (req) => {
            return extractUidFromSlug(req.params.uid);
        },
        { notFoundMessage: "Note not found." }
    ),
    async (req, res) => {
        try {
            const note = await Note.findOne({
                where: { uid: req.params.uid }
            });

            await note.destroy();
            res.json({ message: "Note deleted successfully." });
        } catch (error) {
            logError("Error deleting note:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

module.exports = router;
