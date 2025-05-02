require 'net/http'
require 'uri'
require 'nokogiri'

class UrlTitleExtractorService
  # Maximum request size to avoid downloading entire page
  MAX_BYTES = 50000
  # Timeout for the HTTP request in seconds
  TIMEOUT = 5
  # User agent string to appear as a regular browser
  USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  
  # Check if a string looks like a URL
  def self.url?(text)
    # Basic URL validation regex
    url_regex = %r{^(https?://)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$}i
    text.strip.match?(url_regex)
  end
  
  # Extract the title from a URL
  def self.extract_title(url)
    # Ensure URL has http/https prefix
    url = "http://#{url}" unless url.start_with?('http://') || url.start_with?('https://')
    
    begin
      uri = URI.parse(url)
      http = Net::HTTP.new(uri.host, uri.port)
      
      # Set timeouts to avoid hanging
      http.open_timeout = TIMEOUT
      http.read_timeout = TIMEOUT
      
      # Use SSL if needed
      if uri.scheme == 'https'
        http.use_ssl = true
        http.verify_mode = OpenSSL::SSL::VERIFY_NONE
      end
      
      # Create a request that will only download partial content
      request = Net::HTTP::Get.new(uri.request_uri)
      request['User-Agent'] = USER_AGENT
      request['Accept'] = 'text/html'
      request['Range'] = "bytes=0-#{MAX_BYTES}"
      
      response = http.request(request)
      
      # Allow redirects
      if response.is_a?(Net::HTTPRedirection)
        redirect_url = response['location']
        return extract_title(redirect_url)
      end
      
      # Parse HTML and extract title
      if response.code.to_i.between?(200, 299) && response.body
        html = Nokogiri::HTML(response.body)
        
        # Try to extract the title tag
        title = html.at_css('title')&.text&.strip
        return title if title && !title.empty?
        
        # Alternative: try Open Graph title
        og_title = html.at_css('meta[property="og:title"]')&.attributes['content']&.value&.strip
        return og_title if og_title && !og_title.empty?
        
        # Alternative: try Twitter card title
        twitter_title = html.at_css('meta[name="twitter:title"]')&.attributes['content']&.value&.strip
        return twitter_title if twitter_title && !twitter_title.empty?
      end
      
      # If we can't find a title, return nil
      nil
    rescue => e
      puts "Error extracting title from URL: #{e.message}"
      nil
    end
  end
  
  # Extract title from text if it contains a URL
  def self.extract_title_from_text(text)
    # Split the text by whitespace and check each word
    text.split(/\s+/).each do |word|
      if url?(word)
        title = extract_title(word)
        return { url: word, title: title } if title
      end
    end
    nil
  end
end