module Sinatra
  class Application
    def update_task_tags(task, tags_json)
      return if tags_json.blank?

      begin
        tag_names = JSON.parse(tags_json).map { |tag| tag['value'] }.uniq
        tags = tag_names.map do |name|
          current_user.tags.find_or_create_by(name: name)
        end
        task.tags = tags
      rescue JSON::ParserError
        puts "Failed to parse JSON for tags: #{tags_json}"
      end
    end

    get '/tasks' do
      # Base query with necessary joins
      base_query = current_user.tasks.includes(:project, :tags)

      # Apply filters based on due_date and status
      @tasks = case params[:type]
               when 'today'
                 base_query
               .where('status = ? OR (status = ? AND due_date <= ?)',
                      Task.statuses[:in_progress],
                      Task.statuses[:not_started],
                      Date.today.end_of_day)
               when 'upcoming'
                 base_query
               .where('(status = ? OR status = ?) AND due_date BETWEEN ? AND ?',
                      Task.statuses[:in_progress],
                      Task.statuses[:not_started],
                      Date.today,
                      Date.today + 7.days)
               when 'never'
                 base_query.incomplete.where(due_date: nil)
               else
                 params[:status] == 'done' ? base_query.complete : base_query.incomplete
               end

      # Apply ordering
      if params[:order_by]
        order_column, order_direction = params[:order_by].split(':')
        order_direction ||= 'asc'

        @tasks = if order_column == 'due_date'
                   @tasks.order(Arel.sql("CASE WHEN tasks.due_date IS NULL THEN 1 ELSE 0 END, tasks.due_date #{order_direction}"))
                 else
                   @tasks.order("tasks.#{order_column} #{order_direction}")
                 end
      end

      # Filter by tag if provided
      if params[:tag]
        tagged_task_ids = Tag.joins(:tasks).where(name: params[:tag],
                                                  tasks: { user_id: current_user.id }).select('tasks.id')
        @tasks = @tasks.where(id: tagged_task_ids)
      end

      @tasks = @tasks.left_joins(:tags).distinct

      erb :'tasks/index'
    end

    post '/task/create' do
      task_attributes = {
        name: params[:name],
        priority: params[:priority],
        due_date: params[:due_date],
        status: params[:status] || Task.statuses[:not_started],
        note: params[:note],
        user_id: current_user.id
      }

      if params[:project_id].blank?
        task = current_user.tasks.build(task_attributes)
      else
        project = current_user.projects.find_by(id: params[:project_id])
        halt 400, 'Invalid project.' unless project
        task = project.tasks.build(task_attributes)
      end

      if task.save
        update_task_tags(task, params[:tags])
        redirect request.referrer || '/'
      else
        halt 400, 'There was a problem creating the task.'
      end
    end

    patch '/task/:id' do
      task = current_user.tasks.find_by(id: params[:id])

      halt 404, 'Task not found.' unless task

      task_attributes = {
        name: params[:name],
        priority: params[:priority],
        status: params[:status] || Task.statuses[:not_started],
        note: params[:note],
        due_date: params[:due_date]
      }

      if params[:project_id] && !params[:project_id].empty?
        project = current_user.projects.find_by(id: params[:project_id])
        halt 400, 'Invalid project.' unless project
        task.project = project
      else
        task.project = nil
      end

      if task.update(task_attributes)
        update_task_tags(task, params[:tags])
        redirect request.referrer || '/'
      else
        halt 400, 'There was a problem updating the task.'
      end
    end

    patch '/task/:id/toggle_completion' do
      content_type :json
      task = current_user.tasks.find_by(id: params[:id])

      if task
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
      else
        status 400
        { error: 'Task not found' }.to_json
      end
    end

    delete '/task/:id' do
      task = current_user.tasks.find_by(id: params[:id])
      halt 404, 'Task not found.' unless task

      if task.destroy
        redirect request.referrer || '/'
      else
        halt 400, 'There was a problem deleting the task.'
      end
    end
  end
end
