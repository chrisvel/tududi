class Sinatra::Application
  # Get all tags with JSON response
  get '/api/tags' do
    content_type :json

    # Fetch all tags for the current user
    tags = current_user.tags.order('name ASC')

    # Return the tags as JSON
    tags.as_json(only: %i[id name]).to_json
  end

  # Get a specific tag by ID with JSON response
  get '/api/tag/:id' do
    content_type :json

    # Find the tag by ID
    tag = current_user.tags.find_by(id: params[:id])

    # Return a 404 status if the tag is not found
    halt 404, { error: 'Tag not found' }.to_json unless tag

    # Return the tag as JSON
    tag.as_json(only: %i[id name]).to_json
  end

  # Create a new tag with JSON response
  post '/api/tag' do
    content_type :json

    # Parse the request body to get the tag name
    request_body = JSON.parse(request.body.read)
    tag = current_user.tags.new(name: request_body['name'])

    # Attempt to save the tag
    if tag.save
      # Return the newly created tag as JSON
      status 201
      tag.as_json(only: %i[id name]).to_json
    else
      # Return an error message with a 400 status if the tag creation fails
      status 400
      { error: 'There was a problem creating the tag.' }.to_json
    end
  end

  # Update an existing tag by ID with JSON response
  patch '/api/tag/:id' do
    content_type :json

    # Find the tag by ID
    tag = current_user.tags.find_by(id: params[:id])

    # Return a 404 status if the tag is not found
    halt 404, { error: 'Tag not found' }.to_json unless tag

    # Parse the request body to get the updated tag name
    request_body = JSON.parse(request.body.read)
    tag.name = request_body['name']

    # Attempt to save the updated tag
    if tag.save
      # Return the updated tag as JSON
      tag.as_json(only: %i[id name]).to_json
    else
      # Return an error message with a 400 status if the update fails
      status 400
      { error: 'There was a problem updating the tag.' }.to_json
    end
  end

  # Delete an existing tag by ID with JSON response
  delete '/api/tag/:id' do
    content_type :json

    # Find the tag by ID
    tag = current_user.tags.find_by(id: params[:id])

    # Return a 404 status if the tag is not found
    halt 404, { error: 'Tag not found' }.to_json unless tag

    # Attempt to delete the tag
    if tag.destroy
      # Return a success message
      { message: 'Tag successfully deleted' }.to_json
    else
      # Return an error message with a 400 status if deletion fails
      status 400
      { error: 'There was a problem deleting the tag.' }.to_json
    end
  end
end
