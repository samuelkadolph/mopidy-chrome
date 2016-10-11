require "net/http"
require "json"

def local_version
  JSON.parse(File.read("manifest.json"))["version"]
end

def package_path
  "pkg/mopidy-remote-#{local_version}.zip"
end

def webstore_draft_version
  webstore_version("draft")
end

def webstore_publish(target = "default")
  # TODO: publishTarget: trustedTesters

  item = webstore_request("/chromewebstore/v1.1/items/#{extension_id}/publish", method: :Post)
  item["status"][0] == "OK"
end

def webstore_published_version
  webstore_version("published")
end

def webstore_upload(path)
  item = webstore_request("/upload/chromewebstore/v1.1/items/#{extension_id}", method: :Put, data: File.read(path))
  item["uploadState"] == "SUCCESS"
end

private
def access_token
  params = {}
  params["client_id"] = secrets["oauth_client_id"]
  params["client_secret"] = secrets["oauth_client_secret"]
  params["grant_type"] = "refresh_token"
  params["refresh_token"] = secrets["oauth_refresh_token"]

  response = Net::HTTP.post_form(URI("https://accounts.google.com/o/oauth2/token"), params)
  response.error! unless response.code == "200"

  token = JSON.parse(response.body)
  token["access_token"]
end

def extension_id
  secrets["_extension_id"]
end

def secrets
  @secrets ||= begin
    file = File.expand_path("../../secrets.ejson", __FILE__)
    decrypted = `bundle exec ejson decrypt #{file}`
    JSON.parse(decrypted)
  end
end

def webstore_version(projection)
  item = webstore_request("/chromewebstore/v1.1/items/#{extension_id}?projection=#{projection}")
  item["crxVersion"]
rescue Net::HTTPServerException => e
  if e.response.code == "403"
    "N/A"
  else
    raise
  end
end

def webstore_request(path, data: nil, headers: nil, method: :Get)
  h = {}
  h["Authorization"] = "Bearer #{access_token}"
  h["x-goog-api-version"] = "2"
  h.merge!(headers) if headers

  http = Net::HTTP.new("www.googleapis.com", 443)
  http.use_ssl = true

  request = Net::HTTP.const_get(method).new(path, h)

  response = http.request(request, data)
  response.error! unless response.code == "200"
  JSON.parse(response.body)
end
