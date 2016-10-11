require "fileutils"
require "json"

require_relative "./lib/rake"

desc "Build the extension package"
task :build do
  FileUtils.mkdir_p("pkg")

  sh "zip", package_path, *Dir["fonts/*.woff2", "images/*.png", "javascripts/*.js", "stylesheets/*.css", "*.{html,json}"]

  puts "Package built and is available at #{package_path}"
end

desc "Delete the pkg directory"
task :clean do
  FileUtils.rm_rf("pkg")
end

desc "Builds, uploads, and publishes the extension"
task :publish => %W[build webstore:upload webstore:publish]

namespace :webstore do
  desc "Print the draft and published versions in the Web Store"
  task :info do
    puts "Local version: #{local_version}"
    puts "Draft version: #{webstore_draft_version}"
    # puts "Published version: #{webstore_published_version}"
  end

  desc "Publish the draft in the Web Store"
  task :publish do
    print "Publishing... "

    if webstore_publish
      puts "success!"
    else
      puts "failed!"
      exit 1
    end
  end

  desc "Upload the extension to the Web Store"
  task :upload do
    print "Uploading #{package_path}... "

    if webstore_upload(package_path)
      puts "success!"
    else
      puts "failed!"
      exit 1
    end
  end
end

task :default => :build
