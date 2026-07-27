#!/usr/bin/env ruby
# scripts/xcode_add_bridging_header.rb — sets SWIFT_OBJC_BRIDGING_HEADER on
# the HaylinguaMobile target for every build configuration, using the
# xcodeproj gem (the standard, safe way to edit an Xcode project
# programmatically) instead of hand-patching project.pbxproj text.
Dir['/opt/homebrew/Cellar/cocoapods/1.17.0/libexec/gems/*/lib'].each { |d| $LOAD_PATH.unshift(d) }
require 'xcodeproj'

project_path = File.expand_path('../ios/HaylinguaMobile.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'HaylinguaMobile' }
raise "target HaylinguaMobile not found" unless target

header_path = 'HaylinguaMobile/HaylinguaMobile-Bridging-Header.h'

target.build_configurations.each do |config|
  config.build_settings['SWIFT_OBJC_BRIDGING_HEADER'] = header_path
end

project.save
puts "Set SWIFT_OBJC_BRIDGING_HEADER = #{header_path} on #{target.build_configurations.map(&:name).join(', ')}"
