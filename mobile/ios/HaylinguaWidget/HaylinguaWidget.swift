//
//  HaylinguaWidget.swift
//  HaylinguaWidget
//
//  Reads streak/XP written by the main app into the shared App Group
//  UserDefaults suite (see src/lib/widgetBridge.js — statsStore.refresh()
//  writes there on every stats refresh) and shows it small/medium. No
//  network access from the widget itself — it only ever reads what the
//  app last wrote, refreshing its timeline whenever iOS decides to.
//
import WidgetKit
import SwiftUI

private let appGroupId = "group.org.reactjs.native.example.HaylinguaMobile.shared"
private let brandOrange = Color(red: 255 / 255, green: 122 / 255, blue: 26 / 255)

struct StreakEntry: TimelineEntry {
  let date: Date
  let streak: Int
  let totalXp: Int
  let heartsCurrent: Int
  let isPremium: Bool
}

struct StreakProvider: TimelineProvider {
  func placeholder(in context: Context) -> StreakEntry {
    StreakEntry(date: Date(), streak: 7, totalXp: 420, heartsCurrent: 5, isPremium: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (StreakEntry) -> Void) {
    completion(readEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StreakEntry>) -> Void) {
    let entry = readEntry()
    // Streak/XP only change from real app usage, not on a clock — refresh
    // hourly so the widget still eventually catches up if the shared
    // defaults changed while the widget process was suspended.
    let nextRefresh = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date().addingTimeInterval(3600)
    completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
  }

  private func readEntry() -> StreakEntry {
    let defaults = UserDefaults(suiteName: appGroupId)
    return StreakEntry(
      date: Date(),
      streak: defaults?.integer(forKey: "streak") ?? 0,
      totalXp: defaults?.integer(forKey: "totalXp") ?? 0,
      heartsCurrent: defaults?.integer(forKey: "heartsCurrent") ?? 0,
      isPremium: defaults?.bool(forKey: "isPremium") ?? false
    )
  }
}

struct HaylinguaWidgetEntryView: View {
  @Environment(\.widgetFamily) var family
  var entry: StreakProvider.Entry

  var body: some View {
    switch family {
    case .systemMedium:
      HStack(spacing: 20) {
        stat(icon: "flame.fill", color: brandOrange, value: "\(entry.streak)", label: "Day streak")
        stat(icon: "bolt.fill", color: .yellow, value: "\(entry.totalXp)", label: "Total XP")
        stat(
          icon: "heart.fill",
          color: .red,
          value: entry.isPremium ? "∞" : "\(entry.heartsCurrent)",
          label: "Hearts"
        )
      }
      .padding()
    default:
      VStack(spacing: 6) {
        Image(systemName: "flame.fill")
          .font(.system(size: 28))
          .foregroundColor(brandOrange)
        Text("\(entry.streak)")
          .font(.system(size: 32, weight: .heavy, design: .rounded))
        Text("day streak")
          .font(.caption)
          .foregroundColor(.secondary)
      }
      .padding()
    }
  }

  @ViewBuilder
  private func stat(icon: String, color: Color, value: String, label: String) -> some View {
    VStack(spacing: 4) {
      Image(systemName: icon).foregroundColor(color)
      Text(value).font(.system(size: 20, weight: .heavy, design: .rounded))
      Text(label).font(.caption2).foregroundColor(.secondary)
    }
    .frame(maxWidth: .infinity)
  }
}

struct HaylinguaStreakWidget: Widget {
  let kind: String = "HaylinguaStreakWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: StreakProvider()) { entry in
      HaylinguaWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Haylingua Streak")
    .description("Your daily streak, XP, and hearts at a glance.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
