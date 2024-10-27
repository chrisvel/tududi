class Sinatra::Application
  get '/api/tags' do
    content_type :json

    tags = current_user.tags.order('name ASC')

    tags.as_json(only: %i[id name]).to_json
  end

  get '/api/tag/:id' do
    content_type :json

    tag = current_user.tags.find_by(id: params[:id])

    halt 404, { error: 'Tag not found' }.to_json unless tag

    tag.as_json(only: %i[id name]).to_json
  end

  post '/api/tag' do
    content_type :json

    request_body = JSON.parse(request.body.read)
    tag = current_user.tags.new(name: request_body['name'])

    if tag.save
      status 201
      tag.as_json(only: %i[id name]).to_json
    else
      status 400
      { error: 'There was a problem creating the tag.' }.to_json
    end
  end

  patch '/api/tag/:id' do
    content_type :json

    tag = current_user.tags.find_by(id: params[:id])

    halt 404, { error: 'Tag not found' }.to_json unless tag

    request_body = JSON.parse(request.body.read)
    tag.name = request_body['name']

    if tag.save
      tag.as_json(only: %i[id name]).to_json
      status 400
      { error: 'There was a problem updating the tag.' }.to_json
    end
  end

  delete '/api/tag/:id' do
    content_type :json

    tag = current_user.tags.find_by(id: params[:id])

    halt 404, { error: 'Tag not found' }.to_json unless tag

    if tag.destroy
      { message: 'Tag successfully deleted' }.to_json
    else
      status 400
      { error: 'There was a problem deleting the tag.' }.to_json
    end
  end
end
