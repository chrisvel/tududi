module Sinatra
  class Application
    def update_task_tags(task, tags_data)
      return if tags_data.nil?

      tag_names = tags_data.map { |tag| tag['name'] }.compact.reject(&:empty?).uniq

      existing_tags = Tag.where(user: current_user, name: tag_names)
      new_tags = tag_names - existing_tags.pluck(:name)
      created_tags = new_tags.map { |name| Tag.create(name: name, user: current_user) }

      task.tags = (existing_tags + created_tags).uniq
    end

    get '/api/tasks' do
      content_type :json

      @tasks = current_user.tasks.includes(:project, :tags)

      @tasks = case params[:type]
               when 'today'
                 @tasks.due_today
               when 'upcoming'
                 @tasks.upcoming
               when 'next'
                 @tasks.next_actions
               when 'inbox'
                 @tasks.inbox
               when 'someday'
                 @tasks.someday
               when 'waiting'
                 @tasks.waiting_for
               else
                 params[:status] == 'done' ? @tasks.complete : @tasks.incomplete
               end

      @tasks = @tasks.with_tag(params[:tag]) if params[:tag]

      if params[:order_by]
        order_column, order_direction = params[:order_by].split(':')
        order_direction ||= 'asc'
        order_direction = order_direction.downcase == 'desc' ? :desc : :asc

        allowed_columns = %w[created_at updated_at name priority status due_date]
        if allowed_columns.include?(order_column)
          @tasks = if order_column == 'due_date'
                     @tasks.ordered_by_due_date(order_direction)
                   else
                     @tasks.order("tasks.#{order_column} #{order_direction}")
                   end
        else
          halt 400, { error: 'Invalid order column specified.' }.to_json
        end
      end

      @tasks = @tasks.left_joins(:tags).distinct

      @tasks.to_json(include: { tags: { only: %i[id name] }, project: { only: :name } })
    end

    post '/api/task' do
      content_type :json

      request_body = request.body.read
      task_data = begin
        JSON.parse(request_body)
      rescue JSON::ParserError => e
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end

      task_attributes = {
        name: task_data['name'],
        priority: task_data['priority'] || 'medium',
        due_date: task_data['due_date'],
        status: task_data['status'] || Task.statuses[:not_started],
        note: task_data['note'],
        user_id: current_user.id
      }

      value = task_data['project_id']
      task = if value.nil? || value.to_s.strip.empty?
               current_user.tasks.build(task_attributes)
             else
               project = current_user.projects.find_by(id: value)
               halt 400, { error: 'Invalid project.' }.to_json unless project
               project.tasks.build(task_attributes)
             end

      if task.save
        update_task_tags(task, task_data['tags'])
        status 201
        task.to_json(include: { tags: { only: :name }, project: { only: :name } })
      else
        errors = task.errors.full_messages
        halt 400, { error: 'There was a problem creating the task.', details: errors }.to_json
      end
    end

    patch '/api/task/:id' do
      content_type :json
      puts "Request to update task with ID: #{params[:id]}"
      puts "Current user: #{current_user&.id}"

      request_body = request.body.read
      task_data = begin
        JSON.parse(request_body)
      rescue JSON::ParserError => e
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end

      task = current_user.tasks.find_by(id: params[:id])

      halt 404, { error: 'Task not found.' }.to_json unless task

      task_attributes = {
        name: task_data['name'], # Get the name from the JSON body
        priority: task_data['priority'],
        status: task_data['status'] || Task.statuses[:not_started],
        note: task_data['note'],
        due_date: task_data['due_date']
      }

      if task_data['project_id'] && !task_data['project_id'].to_s.strip.empty?
        project = current_user.projects.find_by(id: task_data['project_id'])
        halt 400, { error: 'Invalid project.' }.to_json unless project
        task.project = project
      else
        task.project = nil
      end

      if task.update(task_attributes)
        update_task_tags(task, task_data['tags'])
        task.to_json(include: { tags: { only: :name }, project: { only: :name } })
      else
        errors = task.errors.full_messages
        halt 400, { error: 'There was a problem updating the task.', details: errors }.to_json
      end
    end

    patch '/api/task/:id/toggle_completion' do
      content_type :json

      task = current_user.tasks.find_by(id: params[:id])
      halt 404, { error: 'Task not found.' }.to_json unless task

      new_status = if task.done?
                     task.note.present? ? :in_progress : :not_started
                   else
                     :done
                   end
      task.status = new_status

      if task.save
        task.to_json
      else
        status 422
        { error: 'Unable to update task' }.to_json
      end
    end

    delete '/api/task/:id' do
      content_type :json

      task = current_user.tasks.find_by(id: params[:id])
      halt 404, { error: 'Task not found.' }.to_json unless task

      if task.destroy
        status 200
        { message: 'Task successfully deleted' }.to_json
      else
        halt 400, { error: 'There was a problem deleting the task.' }.to_json
      end
    end
  end
end
