FROM ruby:3.2.2-slim

RUN apt-get update -qq && apt-get install -y build-essential libsqlite3-dev openssl

WORKDIR /usr/src/app

COPY Gemfile* ./

RUN bundle config set without 'development test' && bundle install

COPY . .

EXPOSE 9292

ENV RACK_ENV=production

RUN mkdir -p certs && \
    openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj '/CN=localhost'

RUN rake db:migrate

CMD ["puma", "-C", "app/config/puma.rb"]
