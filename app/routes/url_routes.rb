require_relative '../services/url_title_extractor_service'

module Sinatra
  class Application
    get '/api/url/title' do
      content_type :json

      url = params[:url]
      halt 400, { error: 'URL parameter is required' }.to_json unless url

      title = UrlTitleExtractorService.extract_title(url)

      if title
        { url: url, title: title }.to_json
      else
        { url: url, title: nil, error: 'Could not extract title' }.to_json
      end
    end

    post '/api/url/extract-from-text' do
      content_type :json

      request_body = request.body.read

      begin
        data = JSON.parse(request_body)
        text = data['text']

        halt 400, { error: 'Text parameter is required' }.to_json unless text

        result = UrlTitleExtractorService.extract_title_from_text(text)

        if result
          result.to_json
        else
          { found: false }.to_json
        end
      rescue JSON::ParserError
        halt 400, { error: 'Invalid JSON format' }.to_json
      end
    end
  end
end
