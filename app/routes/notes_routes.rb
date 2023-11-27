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

  get '/notes' do
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

    erb :'notes/index'
  end

  post '/note/create' do
    note_attributes = {
      title: params[:title],
      content: params[:content],
      user_id: current_user.id
    }

    if params[:project_id].empty?
      note = current_user.notes.build(note_attributes)
    else
      project = current_user.projects.find_by(id: params[:project_id])
      halt 400, 'Invalid project.' unless project
      note = project.notes.build(note_attributes)
    end

    if note.save
      update_note_tags(note, params[:tags])
      redirect request.referrer || '/'
    else
      halt 400, 'There was a problem creating the note.'
    end
  end

  patch '/note/:id' do
    note = current_user.notes.find_by(id: params[:id])
    halt 404, 'Note not found.' unless note

    note_attributes = {
      title: params[:title],
      content: params[:content]
    }

    if params[:project_id] && !params[:project_id].empty?
      project = current_user.projects.find_by(id: params[:project_id])
      halt 400, 'Invalid project.' unless project
      note.project = project
    else
      note.project = nil
    end

    if note.update(note_attributes)
      update_note_tags(note, params[:tags])
      redirect request.referrer || '/'
    else
      halt 400, 'There was a problem updating the note.'
    end
  end

  delete '/note/:id' do
    note = current_user.notes.find_by(id: params[:id])
    halt 404, 'Note not found.' unless note

    if note.destroy!
      redirect '/notes'
    else
      halt 400, 'There was a problem deleting the note.'
    end
  end
end
