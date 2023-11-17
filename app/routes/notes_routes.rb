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
    @notes = current_user.notes.includes(:tags)
    erb :'notes/index'
  end

  post '/note/create' do
    note_attributes = {
      title: params[:title],
      content: params[:content],
      user_id: current_user.id
    }

    note = current_user.notes.build(note_attributes)

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
