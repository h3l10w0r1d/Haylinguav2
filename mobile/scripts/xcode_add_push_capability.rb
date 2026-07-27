#!/usr/bin/env ruby
# scripts/xcode_add_push_capability.rb — points the target at
# HaylinguaMobile.entitlements (aps-environment) and marks the Push
# Notifications capability enabled in the project's TargetAttributes, same
# as what Xcode's "Signing & Capabilities" tab writes when you click
# "+ Capability" -> Push Notifications.
Dir['/opt/homebrew/Cellar/cocoapods/1.17.0/libexec/gems/*/lib'].each { |d| $LOAD_PATH.unshift(d) }
require 'xcodeproj'

project_path = File.expand_path('../ios/HaylinguaMobile.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'HaylinguaMobile' }
raise "target HaylinguaMobile not found" unless target

entitlements_path = 'HaylinguaMobile/HaylinguaMobile.entitlements'
target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = entitlements_path
end

attributes = project.root_object.attributes
attributes['TargetAttributes'] ||= {}
attributes['TargetAttributes'][target.uuid] ||= {}
attributes['TargetAttributes'][target.uuid]['SystemCapabilities'] ||= {}
attributes['TargetAttributes'][target.uuid]['SystemCapabilities']['com.apple.Push'] = { 'enabled' => 1 }

project.save
puts "Set CODE_SIGN_ENTITLEMENTS = #{entitlements_path} and enabled Push Notifications capability"
