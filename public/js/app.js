document.addEventListener("DOMContentLoaded", function () {
  attachEventListeners();
  new Tagify(document.getElementById('task_tags'));
});

function attachEventListeners() {
  attachCollapseListeners();
  attachTaskClickListeners();
  attachProjectModalListeners();
  attachAreaModalListeners();
}

function attachCollapseListeners() {
  document.querySelectorAll('.collapse').forEach(collapseElement => {
    collapseElement.addEventListener('show.bs.collapse', () => toggleFolderIcon(collapseElement, true));
    collapseElement.addEventListener('hide.bs.collapse', () => toggleFolderIcon(collapseElement, false));
  });
}

function toggleFolderIcon(collapseElement, isOpening) {
  const closedFolderIcon = collapseElement.previousElementSibling?.querySelector('.bi-folder');
  const openFolderIcon = collapseElement.previousElementSibling?.querySelector('.bi-folder2-open');

  if (closedFolderIcon && openFolderIcon) {
    closedFolderIcon.classList.toggle('d-none', isOpening);
    openFolderIcon.classList.toggle('d-none', !isOpening);
  }
}

function attachTaskClickListeners() {
  document.querySelectorAll('.task-item').forEach(taskElement => {
    taskElement.addEventListener('click', event => {
      if (!event.target.closest('.toggle-completion')) {
        openEditTaskModal(taskElement.dataset.taskId);
      }
    });
  });
}

function openEditTaskModal(taskId) {
  const formContainer = document.getElementById('edit_task_form_' + taskId);
  if (!formContainer) {
    console.error('Edit form not found for task: ' + taskId);
    return;
  }
  const formHtml = formContainer.innerHTML;
  const editTaskFormContainer = document.getElementById('editTaskFormContainer');
  editTaskFormContainer.innerHTML = formHtml;

  new Tagify(editTaskFormContainer.querySelector('#task_tags'));

  new bootstrap.Modal(document.getElementById('editTaskModal')).show();
}


function attachProjectModalListeners() {
  document.querySelectorAll('[data-bs-toggle="modal"][data-project-id]').forEach(button => {
    button.addEventListener('click', () => openProjectModalForEdit(button.getAttribute('data-project-id')));
  });
}

function openProjectModalForEdit(projectId) {
  fetch('/project/' + projectId)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok.');
      }
      return response.json();
    })
    .then(projectData => {
      document.getElementById('projectName').value = projectData.name;
      document.getElementById('projectDescription').value = projectData.description || '';
      var projectForm = document.getElementById('projectForm');
      if (projectForm) {
        projectForm.action = '/projects/' + projectId;
        projectForm.method = 'patch';
      }

      var modal = new bootstrap.Modal(document.getElementById('editProjectModal'));
      modal.show();
    })
    .catch(error => {
      console.error('Error fetching project data:', error);
    });
}

function attachAreaModalListeners() {
  document.querySelectorAll('.open-new-area-modal').forEach(button => {
    button.addEventListener('click', () => new bootstrap.Modal(document.getElementById('newAreaModal')).show());
  });

  document.querySelectorAll('.open-edit-area-modal').forEach(button => {
    button.addEventListener('click', () => openEditAreaModal(button.dataset.areaId));
  });
}

function openNewProjectModal() {
  const modal = new bootstrap.Modal(document.getElementById('newProjectModal'));
  modal.show();
}

function deleteProject(projectId) {
  if (confirm('Are you sure you want to delete this project?')) {
    const form = document.getElementById('delete_project_' + projectId);
    form.submit();
  }
}

function openNewAreaModal() {
  const modal = new bootstrap.Modal(document.getElementById('newAreaModal'));
  modal.show();
}

function deleteArea(areaId) {
  if (confirm('Are you sure you want to delete this area?')) {
    const form = document.getElementById('delete_area_' + areaId);
    form.submit();
  }
}

function openEditAreaModal(areaId) {
  fetchAreaDataAndPopulateModal(areaId);
  const modal = new bootstrap.Modal(document.getElementById('editAreaModal'));
  modal.show();
}

function fetchAreaDataAndPopulateModal(areaId) {
  fetch('/areas/' + areaId + '/data')
    .then(response => response.json())
    .then(areaData => {
      populateAreaEditForm(areaData);
    })
    .catch(error => console.error('Error fetching area data:', error));
}

function populateAreaEditForm(areaData) {
  document.getElementById('editAreaName').value = areaData.name;
}

function toggleTaskCompletion(event, taskId) {
  event.stopPropagation();
  fetch('/task/' + taskId + '/toggle_completion', {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({_method: 'patch'})
  })
  .then(response => {
    if (!response.ok) throw new Error('Network response was not ok');
    return response.json();
  })
  .then(data => updateTaskCompletionStatus(taskId, data))
  .catch(error => console.error('There has been a problem with your fetch operation:', error));
}

function updateTaskCompletionStatus(taskId, data) {
  const iconSpan = document.querySelector('.task-item[data-task-id="' + taskId + '"] .toggle-completion');
  const taskIcon = iconSpan.querySelector('.bi');
  const taskDiv = iconSpan.closest('.task-item');

  if (data.completed) {
    taskIcon.classList.remove('bi-circle', 'text-warning', 'text-danger');
    taskIcon.classList.add('bi-check-circle-fill', 'text-success');
    taskDiv.classList.add('opacity-50');

  } else {
    taskIcon.classList.remove('bi-check-circle-fill', 'text-success');
    taskIcon.classList.add('bi-circle');
    taskDiv.classList.remove('opacity-50');
    applyPriorityColor(taskIcon, data.priority);
  }
  setTimeout(() => taskDiv.remove(), 200);
}


function applyPriorityColor(taskIcon, priority) {
  taskIcon.classList.remove('text-warning', 'text-danger', 'text-secondary');
  switch (priority) {
    case 'Medium':
      taskIcon.classList.add('text-warning');
      break;
    case 'High':
      taskIcon.classList.add('text-danger');
      break;
    default:
      taskIcon.classList.add('text-secondary');
  }
}



