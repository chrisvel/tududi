class Sinatra::Application
  def update_note_tags(note, tags_json)
    return if tags_json.blank?

    begin
      tag_names = JSON.parse(tags_json).map { |tag| tag['value'] }.uniq
      tags = tag_names.map do |name|
        current_user.tags.find_or_create_by(name: name)
      end
      note.tags = tags
    rescue JSON::ParserError
      puts "Failed to parse JSON for tags: #{tags_json}"
    end
  end

  get '/api/notes' do
    order_by = params[:order_by] || 'title:asc'
    order_column, order_direction = order_by.split(':')

    @notes = current_user.notes.includes(:tags)
    @notes = @notes.joins(:tags).where(tags: { name: params[:tag] }) if params[:tag]
    @notes = @notes.order("notes.#{order_column} #{order_direction}")

    query_params = Rack::Utils.parse_nested_query(request.query_string)
    query_params.delete('tag')
    @base_query = query_params.to_query
    @base_url = '/notes?'
    @base_url += "#{@base_query}&" unless @base_query.empty?

    @notes.to_json(include: :tags)
  end

  get '/api/note/:id' do
    content_type :json
    note = current_user.notes.includes(:tags).find_by(id: params[:id])

    halt 404, { error: 'Note not found.' }.to_json unless note

    # Return the note and its associated tags as JSON
    note.to_json(include: :tags)
  end

  post '/api/note' do
    content_type :json

    # Parse the request body to extract the JSON data
    request_body = request.body.read
    note_data = JSON.parse(request_body, symbolize_names: true)

    # Extract the attributes from the parsed JSON data
    note_attributes = {
      title: note_data[:title],
      content: note_data[:content],
      user_id: current_user.id
    }

    # Check for the presence of a project_id
    if note_data[:project_id].to_s.empty?
      note = current_user.notes.build(note_attributes)
    else
      project = current_user.projects.find_by(id: note_data[:project_id])
      halt 400, { error: 'Invalid project.' }.to_json unless project
      note = project.notes.build(note_attributes)
    end

    # Save the note and update its tags
    if note.save
      update_note_tags(note, note_data[:tags])
      status 201
      note.to_json(include: :tags)
    else
      status 400
      { error: 'There was a problem creating the note.', details: note.errors.full_messages }.to_json
    end
  end

  patch '/api/note/:id' do
    content_type :json
    note = current_user.notes.find_by(id: params[:id])
    halt 404, { error: 'Note not found.' }.to_json unless note

    # Parse the request body to get the content, title, and tags
    request_body = request.body.read
    request_data = JSON.parse(request_body)

    note_attributes = {
      title: request_data['title'],
      content: request_data['content']
    }

    # Handle project association if provided
    if request_data['project_id'] && !request_data['project_id'].to_s.empty?
      project = current_user.projects.find_by(id: request_data['project_id'])
      halt 400, { error: 'Invalid project.' }.to_json unless project
      note.project = project
    else
      note.project = nil
    end

    # Update the note and its tags
    if note.update(note_attributes)
      update_note_tags(note, request_data['tags']) # Process tags correctly
      note.to_json(include: :tags) # Return updated note with tags
    else
      status 400
      { error: 'There was a problem updating the note.', details: note.errors.full_messages }.to_json
    end
  end

  delete '/api/note/:id' do
    content_type :json
    note = current_user.notes.find_by(id: params[:id])
    halt 404, { error: 'Note not found.' }.to_json unless note

    if note.destroy
      { message: 'Note deleted successfully.' }.to_json
    else
      status 400
      { error: 'There was a problem deleting the note.' }.to_json
    end
  end
end
