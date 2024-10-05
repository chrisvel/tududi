# app.rb or your main Sinatra application file

require 'sinatra'
require 'json'

# Assuming you have a helper method `current_user` to get the authenticated user

# Create a new Area
post '/api/areas' do
  content_type :json
  begin
    request_body = request.body.read
    area_data = JSON.parse(request_body, symbolize_names: true)

    # Validate required fields
    halt 400, { error: 'Area name is required.' }.to_json unless area_data[:name] && !area_data[:name].strip.empty?

    # Create new Area
    area = current_user.areas.build(name: area_data[:name], description: area_data[:description])

    if area.save
      status 201
      area.to_json
    else
      status 400
      { error: 'There was a problem creating the area.', details: area.errors.full_messages }.to_json
    end
  rescue JSON::ParserError
    halt 400, { error: 'Invalid JSON.' }.to_json
  end
end

get '/api/areas/:id' do
  area = current_user.areas.find_by(id: params[:id])
  halt 404, { error: "Area not found or doesn't belong to the current user." }.to_json unless area
  area.to_json
end

# Update an existing Area
patch '/api/areas/:id' do
  content_type :json
  begin
    area = current_user.areas.find_by(id: params[:id])
    halt 404, { error: 'Area not found.' }.to_json unless area

    request_body = request.body.read
    area_data = JSON.parse(request_body, symbolize_names: true)

    # Update Area attributes
    area.name = area_data[:name] if area_data[:name]
    area.description = area_data[:description] if area_data[:description]

    if area.save
      status 200
      area.to_json
    else
      status 400
      { error: 'There was a problem updating the area.', details: area.errors.full_messages }.to_json
    end
  rescue JSON::ParserError
    halt 400, { error: 'Invalid JSON.' }.to_json
  end
end

# Delete an Area
delete '/api/areas/:id' do
  content_type :json
  area = current_user.areas.find_by(id: params[:id])
  halt 404, { error: 'Area not found.' }.to_json unless area

  if area.destroy
    status 204
  else
    status 400
    { error: 'There was a problem deleting the area.' }.to_json
  end
end

# Fetch all Areas
get '/api/areas' do
  content_type :json
  areas = current_user.areas
  areas.to_json
end
