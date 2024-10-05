import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskHeader from './TaskHeader';
import TaskForm from './TaskForm';
import TaskActions from './TaskActions';

interface TaskItemProps {
  task: Task;
  onTaskUpdate: (task: Task) => void;
  onTaskDelete: (taskId: number) => void;
  projects: Project[];
}

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onTaskUpdate,
  onTaskDelete,
  projects,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState<Task>(task);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>(task.tags?.map(tag => tag.name) || []);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFormData(task);
    setTags(task.tags?.map(tag => tag.name) || []);
  }, [task]);

  useEffect(() => {
    if (isExpanded) {
      fetch('/api/tags')
        .then((response) => response.json())
        .then((data) => setAvailableTags(data.map((tag: { name: string }) => tag.name)))
        .catch((error) => console.error('Failed to fetch tags', error));
    }
  }, [isExpanded]);

  const handleTaskClick = (e: React.MouseEvent) => {
    if (isEditingTitle) return;
    setIsExpanded(!isExpanded);
  };

  const handleSave = () => {
    onTaskUpdate({ ...formData, tags: tags.map(tag => ({ name: tag })) });
    setIsExpanded(false);
  };

  const handleDelete = () => {
    if (task.id) {
      onTaskDelete(task.id);
    }
  };

  // Find the project associated with this task
  const project = projects.find((p) => p.id === task.project_id);

  return (
    <div className={`border rounded-lg shadow-sm transition-all duration-300 overflow-hidden ${isExpanded ? 'bg-gray-50' : 'bg-white'}`}>
      <TaskHeader
        task={task}
        project={project}
        isEditingTitle={isEditingTitle}
        setIsEditingTitle={setIsEditingTitle}
        formData={formData}
        setFormData={setFormData}
        onTaskUpdate={onTaskUpdate}
      />

      <div
        className="transition-max-height duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isExpanded ? `${contentRef.current?.scrollHeight}px` : '0px',
        }}
      >
        <div ref={contentRef} className="px-4 pb-4">
          <TaskForm
            formData={formData}
            setFormData={setFormData}
            availableTags={availableTags}
            tags={tags}
            handleTagsChange={setTags}
            projects={projects}
            handleChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })}
          />

          <TaskActions
            taskId={task.id}
            onDelete={handleDelete}
            onSave={handleSave}
            onCancel={() => setIsExpanded(false)}
          />
        </div>
      </div>
    </div>
  );
};

export default TaskItem;
