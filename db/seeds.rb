require 'faker'

user = User.create(email: "myemail@somewhere.com", password: "awes0meHax0Rp4ssword")
user_id = user.id

4.times do
  Area.create(name: Faker::Space.galaxy, user_id: user_id)
end

areas = Area.where(user_id: user_id)

total_projects = 10
projects_per_area = total_projects / areas.count
areas.each do |area|
  projects_per_area.times do
    Project.create(
      name: Faker::App.name,
      description: Faker::Lorem.sentence(word_count: 10),
      user_id: user_id,
      area_id: area.id
    )
  end
end

projects = Project.where(user_id: user_id)

projects.each do |project|
  8.times do
    Task.create(
      name: Faker::Lorem.sentence(word_count: 3),
      priority: ['Low', 'Medium', 'High'].sample,
      due_date: [Date.today, Date.today + rand(1..30), nil].sample,
      description: Faker::Lorem.sentence(word_count: 15),
      completed: [true, false].sample,
      user_id: user_id,
      project_id: project.id
    )
  end
end
