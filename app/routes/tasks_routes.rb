module Sinatra
  class Application
    def update_task_tags(task, tags_data)
      return if tags_data.nil?

      # Filter out nil or empty tag names, then ensure uniqueness with `uniq`
      tag_names = tags_data.map { |tag| tag['name'] }.compact.reject(&:empty?).uniq

      # Find or create tags based on the tag names
      existing_tags = Tag.where(name: tag_names)
      new_tags = tag_names - existing_tags.pluck(:name)
      created_tags = new_tags.map { |name| Tag.create(name: name) }

      # Associate only unique tags with the task
      task.tags = (existing_tags + created_tags).uniq
    end

    get '/api/tasks' do
      content_type :json

      # Start with a base query for tasks belonging to the current user
      @tasks = current_user.tasks.includes(:project, :tags)

      # Filter tasks based on the provided `type` parameter
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

      # Apply ordering by due_date or other columns
      if params[:order_by]
        order_column, order_direction = params[:order_by].split(':')
        order_direction ||= 'asc'

        @tasks = if order_column == 'due_date'
                   @tasks.ordered_by_due_date(order_direction)
                 else
                   @tasks.order("#{order_column} #{order_direction}")
                 end
      end

      # Filter by tag if provided
      @tasks = @tasks.with_tag(params[:tag]) if params[:tag]

      @tasks = @tasks.left_joins(:tags).distinct

      # Return the tasks in JSON format with their tags and project
      @tasks.to_json(include: { tags: { only: %i[id name] }, project: { only: :name } })
    end

    post '/api/task' do
      content_type :json

      # Parse the request body as JSON
      request_body = request.body.read
      task_data = begin
        JSON.parse(request_body)
      rescue JSON::ParserError => e
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end

      # Build task attributes
      task_attributes = {
        name: task_data['name'],
        priority: task_data['priority'] || 'medium', # Default priority
        due_date: task_data['due_date'],
        status: task_data['status'] || Task.statuses[:not_started],
        note: task_data['note'],
        user_id: current_user.id
      }

      # Create and assign task to variable
      value = task_data['project_id']
      task = if value.nil? || value.to_s.strip.empty?
               # Assign the built task to the 'task' variable
               current_user.tasks.build(task_attributes)
             else
               project = current_user.projects.find_by(id: value)
               halt 400, { error: 'Invalid project.' }.to_json unless project
               project.tasks.build(task_attributes)
             end

      # Save task and respond
      if task.save
        update_task_tags(task, task_data['tags'])
        status 201
        task.to_json(include: { tags: { only: :name }, project: { only: :name } })
      else
        # Collect error messages for better debugging
        errors = task.errors.full_messages
        halt 400, { error: 'There was a problem creating the task.', details: errors }.to_json
      end
    end

    patch '/api/task/:id' do
      content_type :json
      puts "Request to update task with ID: #{params[:id]}"
      puts "Current user: #{current_user&.id}"

      # Parse the request body as JSON
      request_body = request.body.read
      task_data = begin
        JSON.parse(request_body)
      rescue JSON::ParserError => e
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end

      # Find the task belonging to the current user
      task = current_user.tasks.find_by(id: params[:id])

      halt 404, { error: 'Task not found.' }.to_json unless task

      # Build task attributes
      task_attributes = {
        name: task_data['name'], # Get the name from the JSON body
        priority: task_data['priority'],
        status: task_data['status'] || Task.statuses[:not_started],
        note: task_data['note'],
        due_date: task_data['due_date']
      }

      # Safely handle project_id
      if task_data['project_id'] && !task_data['project_id'].to_s.strip.empty?
        project = current_user.projects.find_by(id: task_data['project_id'])
        halt 400, { error: 'Invalid project.' }.to_json unless project
        task.project = project
      else
        task.project = nil
      end

      # Update task attributes
      if task.update(task_attributes)
        update_task_tags(task, task_data['tags'])
        task.to_json(include: { tags: { only: :name }, project: { only: :name } })
      else
        # Collect error messages for better debugging
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
