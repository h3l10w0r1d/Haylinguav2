//
//  HaylinguaWidgetBundle.swift
//  HaylinguaWidget
//
//  Entry point for the widget extension. A single small+medium streak/XP
//  widget for now — more widgets (e.g. a "next lesson" widget) would be
//  added to this bundle later, not as separate extension targets.
//
import WidgetKit
import SwiftUI

@main
struct HaylinguaWidgetBundle: WidgetBundle {
  var body: some Widget {
    HaylinguaStreakWidget()
  }
}
