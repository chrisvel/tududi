class Sinatra::Application
  post '/areas/create' do
    area = current_user.areas.create(name: params[:name])

    if area.persisted?
      redirect '/'
    else
      @errors = 'There was a problem creating the area.'
      redirect '/'
    end
  end

  patch '/areas/:id' do
    area = current_user.areas.find_by(id: params[:id])

    if area
      area.name = params[:name]

      if area.save
        redirect request.referrer || '/'
      else
        @errors = 'There was a problem updating the area.'
        erb :some_template
      end
    else
      status 404
      "Area not found or doesn't belong to the current user."
    end
  end

  delete '/area/:id' do
    area = current_user.areas.find_by(id: params[:id])

    if area
      area.destroy
      redirect request.referrer || '/'
    else
      status 404
      @errors = 'Area not found or not owned by the current user.'
    end
  end
end
