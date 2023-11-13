class Sinatra::Application
  get '/tasks' do
    case params[:due_date]
    when 'today'
      today = Date.today
      @tasks = current_user.tasks.where(due_date: today.beginning_of_day..today.end_of_day, project: nil)
      @projects_with_tasks = current_user.projects
                                         .joins(:tasks)
                                         .where(tasks: { due_date: today.beginning_of_day..today.end_of_day })
                                         .distinct.order('projects.name ASC')

    when 'upcoming'
      one_week_from_today = Date.today + 7.days
      @tasks = current_user.tasks.where(due_date: Date.today..one_week_from_today, project: nil)
      @projects_with_tasks = current_user.projects.includes(:tasks).where(tasks: { due_date: Date.today..one_week_from_today }).order('projects.name ASC')

    when 'never'
      @tasks = current_user.tasks.where(due_date: nil, project: nil)
      @projects_with_tasks = current_user.projects.includes(:tasks).where(tasks: { due_date: nil }).order('projects.name ASC')

    else
      @tasks = current_user.tasks.where(project: nil)
      @projects_with_tasks = current_user.projects.includes(:tasks).order('projects.name ASC')
    end

    @tasks ||= []
    @projects_with_tasks ||= []

    erb :'tasks/index'
  end

  post '/task/create' do
    task_attributes = {
      name: params[:name],
      priority: params[:priority],
      due_date: params[:due_date],
      user_id: current_user.id
    }

    if params[:project_id].empty?
      task = current_user.tasks.build(task_attributes)
    else
      project = current_user.projects.find_by(id: params[:project_id])
      halt 400, 'Invalid project.' unless project
      task = project.tasks.build(task_attributes)
    end

    if task.save
      redirect request.referrer || '/'
    else
      halt 400, 'There was a problem creating the task.'
    end
  end

  patch '/task/:id' do
    task = current_user.tasks.find_by(id: params[:id])

    halt 404, 'Task not found.' unless task

    task_attributes = {
      name: params[:name],
      priority: params[:priority],
      due_date: params[:due_date]
    }

    if params[:project_id] && !params[:project_id].empty?
      project = current_user.projects.find_by(id: params[:project_id])
      halt 400, 'Invalid project.' unless project
      task.project = project
    else
      task.project = nil
    end

    if task.update(task_attributes)
      redirect request.referrer || '/'
    else
      halt 400, 'There was a problem updating the task.'
    end
  end

  patch '/task/:id/toggle_completion' do
    content_type :json
    task = current_user.tasks.find(params[:id])
    if task
      task.completed = !task.completed
      if task.save
        task.to_json
      else
        status 422
        { error: 'Unable to update task' }.to_json
      end
    else
      status 400
      { error: 'Task not found' }.to_json
    end
  end

  delete '/task/:id' do
    task = current_user.tasks.find_by(id: params[:id])
    halt 404, 'Task not found.' unless task

    if task.destroy
      redirect request.referrer || '/'
    else
      halt 400, 'There was a problem deleting the task.'
    end
  end
end
