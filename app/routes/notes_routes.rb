class Sinatra::Application
  def update_note_tags(note, tags_array)
    return if tags_array.blank?

    begin
      tag_names = tags_array.uniq
      tags = tag_names.map do |name|
        current_user.tags.find_or_create_by(name: name)
      end
      note.tags = tags
    rescue StandardError => e
      puts "Failed to update tags: #{e.message}"
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

    note.to_json(include: :tags)
  end

  post '/api/note' do
    content_type :json

    request_body = request.body.read
    note_data = JSON.parse(request_body, symbolize_names: true)

    note_attributes = {
      title: note_data[:title],
      content: note_data[:content],
      user_id: current_user.id
    }

    if note_data[:project_id].to_s.empty?
      note = current_user.notes.build(note_attributes)
    else
      project = current_user.projects.find_by(id: note_data[:project_id])
      halt 400, { error: 'Invalid project.' }.to_json unless project
      note = project.notes.build(note_attributes)
    end

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

    request_body = request.body.read
    request_data = JSON.parse(request_body)

    note_attributes = {
      title: request_data['title'],
      content: request_data['content']
    }

    if request_data['project_id'] && !request_data['project_id'].to_s.empty?
      project = current_user.projects.find_by(id: request_data['project_id'])
      halt 400, { error: 'Invalid project.' }.to_json unless project
      note.project = project
    else
      note.project = nil
    end

    if note.update(note_attributes)
      update_note_tags(note, request_data['tags'])
      note.to_json(include: :tags)
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
