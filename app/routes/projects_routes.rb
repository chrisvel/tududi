require 'sinatra/namespace'

class Sinatra::Application
  register Sinatra::Namespace

  def update_project_tags(project, tags_data)
    return if tags_data.nil?

    tag_names = tags_data.map { |tag| tag['name'] }.compact.reject(&:empty?).uniq

    existing_tags = Tag.where(user: current_user, name: tag_names)
    new_tags = tag_names - existing_tags.pluck(:name)
    created_tags = new_tags.map { |name| Tag.create(name: name, user: current_user) }

    project.tags = (existing_tags + created_tags).uniq
  end

  namespace '/api' do
    before do
      content_type :json
    end

    get '/projects' do
      active_param = params[:active]
      is_active = active_param == 'true' unless active_param.nil?

      pin_to_sidebar_param = params[:pin_to_sidebar]
      is_pinned = pin_to_sidebar_param == 'true' unless pin_to_sidebar_param.nil?

      area_id_param = params[:area_id]

      projects = current_user.projects
                             .includes(:tags)
                             .left_joins(:tasks, :area)
                             .distinct
                             .order('projects.name ASC')

      projects = projects.where(active: is_active) unless is_active.nil?
      projects = projects.where(pin_to_sidebar: is_pinned) unless is_pinned.nil?
      projects = projects.where(area_id: area_id_param) if area_id_param
      task_status_counts = projects.each_with_object({}) do |project, counts|
        counts[project.id] = project.task_status_counts
      end

      grouped_projects = projects.group_by(&:area)

      {
        projects: projects.as_json(include: { tasks: {}, area: { only: :name }, tags: { only: %i[id name] } }),
        task_status_counts: task_status_counts,
        grouped_projects: grouped_projects.as_json(include: { area: { only: :name } })
      }.to_json
    end

    get '/project/:id' do
      project = current_user.projects.includes(:tasks, :tags).find_by(id: params[:id])

      halt 404, { error: 'Project not found' }.to_json unless project

      project.as_json(include: { tasks: {}, area: { only: %i[id name] }, tags: { only: %i[id name] } }).to_json
    end

    post '/project' do
      request_body = request.body.read
      project_data = begin
        JSON.parse(request_body)
      rescue JSON::ParserError
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end

      project = current_user.projects.new(
        name: project_data['name'],
        description: project_data['description'] || '',
        area_id: project_data['area_id'],
        active: true,
        pin_to_sidebar: false
      )

      if project.save
        update_project_tags(project, project_data['tags'])
        status 201
        project.as_json(include: { tags: { only: %i[id name] } }).to_json
      else
        status 400
        { error: 'There was a problem creating the project.', details: project.errors.full_messages }.to_json
      end
    end

    patch '/project/:id' do
      project = current_user.projects.find_by(id: params[:id])

      halt 404, { error: 'Project not found.' }.to_json unless project

      request_body = request.body.read
      project_data = begin
        JSON.parse(request_body)
      rescue JSON::ParserError
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end

      project.assign_attributes(
        name: project_data['name'],
        description: project_data['description'],
        area_id: project_data['area_id'],
        active: project_data['active'],
        pin_to_sidebar: project_data['pin_to_sidebar']
      )

      if project.save
        update_project_tags(project, project_data['tags'])
        project.as_json(include: { tags: { only: %i[id name] } }).to_json
      else
        status 400
        { error: 'There was a problem updating the project.', details: project.errors.full_messages }.to_json
      end
    end

    delete '/project/:id' do
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
