class Sinatra::Application
  get '/api/areas' do
    areas = current_user.areas.order('name ASC')
    areas.to_json
  end

  get '/api/areas/:id' do
    area = current_user.areas.find_by(id: params[:id])
    halt 404, { error: "Area not found or doesn't belong to the current user." }.to_json unless area
    area.to_json
  end

  # API Route to Create a New Area
  post '/api/areas' do
    area = current_user.areas.create(name: params[:name])

    if area.persisted?
      status 201
      area.to_json
    else
      status 400
      { error: 'There was a problem creating the area.', details: area.errors.full_messages }.to_json
    end
  end

  # API Route to Update an Area
  patch '/api/areas/:id' do
    area = current_user.areas.find_by(id: params[:id])

    if area
      area.name = params[:name]

      if area.save
        area.to_json
      else
        status 400
        { error: 'There was a problem updating the area.', details: area.errors.full_messages }.to_json
      end
    else
      status 404
      { error: "Area not found or doesn't belong to the current user." }.to_json
    end
  end

  # API Route to Delete an Area
  delete '/api/areas/:id' do
    area = current_user.areas.find_by(id: params[:id])

    if area
      area.destroy
      status 204
    else
      status 404
      { error: 'Area not found or not owned by the current user.' }.to_json
    end
  end
end
