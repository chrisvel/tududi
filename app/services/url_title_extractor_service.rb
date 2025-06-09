require 'net/http'
require 'uri'
require 'nokogiri'

class UrlTitleExtractorService
  MAX_BYTES = 50_000
  TIMEOUT = 5
  USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

  def self.url?(text)
    url_regex = %r{^(https?://)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(/.*)?$}i
    text.strip.match?(url_regex)
  end

  def self.extract_title(url)
    url = "http://#{url}" unless url.start_with?('http://') || url.start_with?('https://')

    begin
      uri = URI.parse(url)
      http = Net::HTTP.new(uri.host, uri.port)

      http.open_timeout = TIMEOUT
      http.read_timeout = TIMEOUT

      if uri.scheme == 'https'
        http.use_ssl = true
        http.verify_mode = OpenSSL::SSL::VERIFY_NONE
      end

      request = Net::HTTP::Get.new(uri.request_uri)
      request['User-Agent'] = USER_AGENT
      request['Accept'] = 'text/html'
      request['Range'] = "bytes=0-#{MAX_BYTES}"

      response = http.request(request)

      if response.is_a?(Net::HTTPRedirection)
        redirect_url = response['location']
        return extract_title(redirect_url)
      end

      if response.code.to_i.between?(200, 299) && response.body
        html = Nokogiri::HTML(response.body)

        title = html.at_css('title')&.text&.strip
        return title if title && !title.empty?

        og_title = html.at_css('meta[property="og:title"]')&.attributes&.[]('content')&.value&.strip
        return og_title if og_title && !og_title.empty?

        twitter_title = html.at_css('meta[name="twitter:title"]')&.attributes&.[]('content')&.value&.strip
        return twitter_title if twitter_title && !twitter_title.empty?
      end

      nil
    rescue StandardError => e
      puts "Error extracting title from URL: #{e.message}"
      nil
    end
  end

  def self.extract_title_from_text(text)
    text.split(/\s+/).each do |word|
      if url?(word)
        title = extract_title(word)
        return { url: word, title: title } if title
      end
    end
    nil
  end
end
