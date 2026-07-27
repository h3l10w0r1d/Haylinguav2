#!/usr/bin/env ruby
# scripts/xcode_add_widget_target.rb — scaffolds the HaylinguaWidget target
# (a WidgetKit extension) using the xcodeproj gem: the same mechanism
# CocoaPods itself uses to edit Xcode projects programmatically, rather than
# hand-patching project.pbxproj text (extremely easy to corrupt by hand).
Dir['/opt/homebrew/Cellar/cocoapods/1.17.0/libexec/gems/*/lib'].each { |d| $LOAD_PATH.unshift(d) }
require 'xcodeproj'

project_path = File.expand_path('../ios/HaylinguaMobile.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)

main_target = project.targets.find { |t| t.name == 'HaylinguaMobile' }
raise 'main target HaylinguaMobile not found' unless main_target

if project.targets.any? { |t| t.name == 'HaylinguaWidget' }
  puts 'HaylinguaWidget target already exists — skipping (re-run xcode_add_widget_resources.rb if you only need to refresh file references).'
  exit 0
end

deployment_target = main_target.build_configurations.first.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] || '15.1'

widget_target = project.new_target(:app_extension, 'HaylinguaWidget', :ios, deployment_target, nil, :swift)

# ---- Group + file references -------------------------------------------
widget_group = project.main_group.new_group('HaylinguaWidget', 'HaylinguaWidget')
source_dir = File.expand_path('../ios/HaylinguaWidget', __dir__)

swift_files = %w[HaylinguaWidgetBundle.swift HaylinguaWidget.swift]
swift_files.each do |fname|
  ref = widget_group.new_reference(File.join(source_dir, fname))
  widget_target.source_build_phase.add_file_reference(ref)
end

info_plist_ref = widget_group.new_reference(File.join(source_dir, 'Info.plist'))
entitlements_ref = widget_group.new_reference(File.join(source_dir, 'HaylinguaWidget.entitlements'))

# ---- Frameworks ----------------------------------------------------------
frameworks_group = project.frameworks_group
%w[WidgetKit.framework SwiftUI.framework].each do |fw|
  existing = frameworks_group.files.find { |f| f.path == fw }
  ref = existing || frameworks_group.new_reference("System/Library/Frameworks/#{fw}")
  ref.source_tree = 'SDKROOT' unless existing
  widget_target.frameworks_build_phase.add_file_reference(ref) unless widget_target.frameworks_build_phase.files.any? { |f| f.file_ref == ref }
end

# ---- Build settings -------------------------------------------------------
bundle_id = "org.reactjs.native.example.HaylinguaMobile.HaylinguaWidget"
main_marketing_version = main_target.build_configurations.first.build_settings['MARKETING_VERSION'] || '1.0'
main_project_version = main_target.build_configurations.first.build_settings['CURRENT_PROJECT_VERSION'] || '1'

widget_target.build_configurations.each do |config|
  config.build_settings.merge!(
    'INFOPLIST_FILE' => 'HaylinguaWidget/Info.plist',
    'CODE_SIGN_ENTITLEMENTS' => 'HaylinguaWidget/HaylinguaWidget.entitlements',
    'PRODUCT_BUNDLE_IDENTIFIER' => bundle_id,
    'PRODUCT_NAME' => '$(TARGET_NAME)',
    'SWIFT_VERSION' => '5.0',
    'TARGETED_DEVICE_FAMILY' => '1,2',
    'IPHONEOS_DEPLOYMENT_TARGET' => deployment_target,
    'MARKETING_VERSION' => main_marketing_version,
    'CURRENT_PROJECT_VERSION' => main_project_version,
    'SKIP_INSTALL' => 'YES',
    'GENERATE_INFOPLIST_FILE' => 'NO',
    'CODE_SIGN_STYLE' => 'Automatic',
  )
end

# ---- Wire into the main app: dependency + embed build phase --------------
main_target.add_dependency(widget_target)

embed_phase = main_target.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' }
embed_phase ||= main_target.new_copy_files_build_phase('Embed Foundation Extensions')
embed_phase.dst_subfolder_spec = '13' # PlugIns
embed_phase.dst_path = ''
build_file = embed_phase.add_file_reference(widget_target.product_reference)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

project.save
puts "Added HaylinguaWidget target (bundle id #{bundle_id}), wired as a dependency + embedded extension of HaylinguaMobile."
