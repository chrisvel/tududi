require 'sinatra/namespace'

class Sinatra::Application
  # Include the namespace module
  register Sinatra::Namespace

  # Namespace your routes under /api
  namespace '/api' do
    before do
      content_type :json
    end

    # Get all projects and associated tasks with JSON response
    # Get all projects and associated tasks with JSON response
    get '/projects' do
      # Parse query parameters for 'active', 'pin_to_sidebar', and 'area_id'
      active_param = params[:active]
      is_active = active_param == 'true' unless active_param.nil?

      pin_to_sidebar_param = params[:pin_to_sidebar]
      is_pinned = pin_to_sidebar_param == 'true' unless pin_to_sidebar_param.nil?

      area_id_param = params[:area_id]

      # Build the query
      projects = current_user.projects
                             .left_joins(:tasks, :area)
                             .distinct
                             .order('projects.name ASC')

      # Apply 'active' filter if provided
      projects = projects.where(active: is_active) unless is_active.nil?

      # Apply 'pin_to_sidebar' filter if provided
      projects = projects.where(pin_to_sidebar: is_pinned) unless is_pinned.nil?

      # Apply 'area_id' filter if provided
      projects = projects.where(area_id: area_id_param) if area_id_param

      # Count task statuses for each project
      task_status_counts = projects.each_with_object({}) do |project, counts|
        counts[project.id] = project.task_status_counts
      end

      # Group projects by area
      grouped_projects = projects.group_by(&:area)

      # Return projects, task counts, and grouped projects as JSON
      {
        projects: projects.as_json(include: { tasks: {}, area: { only: :name } }),
        task_status_counts: task_status_counts,
        grouped_projects: grouped_projects.as_json(include: { area: { only: :name } })
      }.to_json
    end

    # Get a specific project by ID with JSON response
    get '/project/:id' do
      # Find the project and include associated tasks
      project = current_user.projects.includes(:tasks).find_by(id: params[:id])

      halt 404, { error: 'Project not found' }.to_json unless project

      # Return the project and associated tasks as JSON
      project.as_json(include: { tasks: {}, area: { only: %i[id name] } }).to_json
    end

    # Create a new project with JSON response
    post '/project' do
      # Parse the request body as JSON
      request_body = request.body.read
      project_data = begin
        JSON.parse(request_body)
      rescue JSON::ParserError
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end

      # Build a new project with the provided parameters
      project = current_user.projects.new(
        name: project_data['name'],
        description: project_data['description'] || '',
        area_id: project_data['area_id'],
        active: true,
        pin_to_sidebar: false
      )

      if project.save
        status 201
        project.as_json.to_json
      else
        status 400
        { error: 'There was a problem creating the project.', details: project.errors.full_messages }.to_json
      end
    end

    # Update an existing project by ID with JSON response
    patch '/project/:id' do
      # Find the project by ID
      project = current_user.projects.find_by(id: params[:id])

      halt 404, { error: 'Project not found.' }.to_json unless project

      # Parse the request body as JSON
      request_body = request.body.read
      project_data = begin
        JSON.parse(request_body)
      rescue JSON::ParserError
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end

      # Update the project with the provided parameters
      project.assign_attributes(
        name: project_data['name'],
        description: project_data['description'],
        area_id: project_data['area_id'],
        active: project_data['active'],
        pin_to_sidebar: project_data['pin_to_sidebar']
      )

      if project.save
        project.as_json.to_json
      else
        status 400
        { error: 'There was a problem updating the project.', details: project.errors.full_messages }.to_json
      end
    end

    # Delete an existing project by ID with JSON response
    delete '/project/:id' do
      # Find the project by ID
      project = current_user.projects.find_by(id: params[:id])

      halt 404, { error: 'Project not found' }.to_json unless project

      if project.destroy
        { message: 'Project successfully deleted' }.to_json
      else
        status 400
        { error: 'There was a problem deleting the project.' }.to_json
      end
    end
  end
end
