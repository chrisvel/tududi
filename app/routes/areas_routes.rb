require 'sinatra'
require 'json'

post '/api/areas' do
  content_type :json
  begin
    request_body = request.body.read
    area_data = JSON.parse(request_body, symbolize_names: true)

    halt 400, { error: 'Area name is required.' }.to_json unless area_data[:name] && !area_data[:name].strip.empty?

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

get '/api/areas' do
  content_type :json
  areas = current_user.areas
  areas.to_json
end
