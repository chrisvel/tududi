class Sinatra::Application
  get '/projects' do
    @projects_with_tasks = current_user.projects.includes(:tasks, :area).order('name ASC')

    erb :'projects/index'
  end

  get '/project/:id' do
    @project = current_user.projects.includes(:tasks).find_by(id: params[:id])
    halt 404, 'Project not found' unless @project

    erb :'projects/show'
  end

  post '/project/create' do
    project = current_user.projects.new(
      name: params[:name],
      description: params[:description],
      area_id: params[:area_id].presence
    )

    if project.save
      redirect request.referrer || '/'
    else
      @errors = 'There was a problem creating the project.'
      redirect '/'
    end
  end

  patch '/project/:id' do
    project = current_user.projects.find_by(id: params[:id])

    if project
      project.name = params[:name]
      project.description = params[:description]
      project.area_id = params[:area_id].presence

      if project.save
        redirect "/project/#{project.id}"
      else
        @errors = 'There was a problem updating the project.'
        erb :edit_project
      end
    else
      status 404
      "Project not found or doesn't belong to the current user."
    end
  end

  delete '/project/:id' do
    project = current_user.projects.find_by(id: params[:id])

    if project
      project.destroy
      redirect '/projects'
    else
      status 404
      "Project not found or doesn't belong to the current user."
    end
  end
end
