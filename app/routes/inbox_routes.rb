module Sinatra
  class Application
    get '/api/inbox' do
      content_type :json

      items = current_user.inbox_items.where(status: 'added').order(created_at: :desc)
      items.to_json
    end

    post '/api/inbox' do
      content_type :json

      request_body = request.body.read
      item_data = begin
        JSON.parse(request_body)
      rescue JSON::ParserError => e
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end

      item = current_user.inbox_items.build(
        content: item_data['content'],
        source: item_data['source'] || 'tududi'
      )

      if item.save
        status 201
        item.to_json
      else
        errors = item.errors.full_messages
        halt 400, { error: 'There was a problem creating the inbox item.', details: errors }.to_json
      end
    end

    patch '/api/inbox/:id' do
      content_type :json

      item = current_user.inbox_items.find_by(id: params[:id])
      halt 404, { error: 'Inbox item not found.' }.to_json unless item

      request_body = request.body.read
      item_data = begin
        JSON.parse(request_body)
      rescue JSON::ParserError => e
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end

      if item.update(content: item_data['content'])
        item.to_json
      else
        errors = item.errors.full_messages
        halt 400, { error: 'There was a problem updating the inbox item.', details: errors }.to_json
      end
    end

    patch '/api/inbox/:id/process' do
      content_type :json

      item = current_user.inbox_items.find_by(id: params[:id])
      halt 404, { error: 'Inbox item not found.' }.to_json unless item

      if item.mark_as_processed!
        item.to_json
      else
        halt 400, { error: 'There was a problem processing the inbox item.' }.to_json
      end
    end

    # Mark an inbox item as deleted
    delete '/api/inbox/:id' do
      content_type :json

      item = current_user.inbox_items.find_by(id: params[:id])
      halt 404, { error: 'Inbox item not found.' }.to_json unless item

      if item.mark_as_deleted!
        { message: 'Inbox item successfully deleted' }.to_json
      else
        halt 400, { error: 'There was a problem deleting the inbox item.' }.to_json
      end
    end

    # Get a specific inbox item by ID
    get '/api/inbox/:id' do
      content_type :json

      item = current_user.inbox_items.find_by(id: params[:id])
      halt 404, { error: 'Inbox item not found.' }.to_json unless item

      item.to_json
    end
  end
end
