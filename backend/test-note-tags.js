const { sequelize, Project, Note, Tag, User } = require('./models');

async function testNoteTagsInProject() {
    try {
        await sequelize.sync();

        // Create test user
        const user = await User.create({
            username: 'testuser' + Date.now(),
            password: 'password123',
            email: 'test@example.com',
        });

        // Create test project
        const project = await Project.create({
            name: 'Test Project',
            description: 'Test',
            user_id: user.id,
        });

        // Create test tags
        const tag1 = await Tag.create({
            name: 'testtag1',
            user_id: user.id,
        });

        const tag2 = await Tag.create({
            name: 'testtag2',
            user_id: user.id,
        });

        // Create test note
        const note = await Note.create({
            title: 'Test Note',
            content: 'Test content',
            user_id: user.id,
            project_id: project.id,
        });

        // Associate tags with note
        await note.setTags([tag1, tag2]);

        // Fetch project with includes (simulating the API call)
        const projectWithNotes = await Project.findOne({
            where: { id: project.id, user_id: user.id },
            include: [
                {
                    model: Note,
                    required: false,
                    attributes: [
                        'id',
                        'title',
                        'content',
                        'created_at',
                        'updated_at',
                    ],
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name'],
                            through: { attributes: [] },
                        },
                    ],
                },
            ],
        });

        console.log('Project found:', !!projectWithNotes);
        console.log('Number of notes:', projectWithNotes.Notes.length);
        if (projectWithNotes.Notes.length > 0) {
            console.log(
                'Note has Tags property:',
                !!projectWithNotes.Notes[0].Tags
            );
            console.log(
                'Number of tags on note:',
                projectWithNotes.Notes[0].Tags.length
            );
            console.log(
                'Note tags:',
                projectWithNotes.Notes[0].Tags.map((t) => t.name)
            );
        }
        console.log(
            'Test PASSED: Notes include tags when fetched through project'
        );

        // Cleanup
        await sequelize.drop();
        process.exit(0);
    } catch (error) {
        console.error('Test FAILED:', error.message);
        process.exit(1);
    }
}

testNoteTagsInProject();
