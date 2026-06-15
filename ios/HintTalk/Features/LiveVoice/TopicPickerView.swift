import SwiftUI

struct TopicPickerView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    var selectedId: String
    var onPick: (TopicPreset) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var search = ""

    private var categories: [TopicCategory] {
        guard !search.trimmed.isEmpty else { return TopicCatalog.categories }
        let q = search.lowercased()
        return TopicCatalog.categories.compactMap { category in
            let topics = category.topics.filter {
                $0.label.lowercased().contains(q)
                    || $0.subtitle.lowercased().contains(q)
                    || $0.situation.lowercased().contains(q)
            }
            guard !topics.isEmpty else { return nil }
            var copy = category
            copy.topics = topics
            return copy
        }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(categories) { category in
                    Section {
                        ForEach(category.topics) { topic in
                            Button {
                                onPick(topic)
                                dismiss()
                            } label: {
                                HStack(alignment: .top, spacing: 10) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(topic.label)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(HT.textLight)
                                        if !topic.subtitle.isEmpty {
                                            Text(topic.subtitle)
                                                .font(.caption)
                                                .foregroundStyle(HT.textDim)
                                                .lineLimit(2)
                                        }
                                    }
                                    Spacer()
                                    if topic.id == selectedId {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(HT.teal)
                                    }
                                }
                            }
                            .listRowBackground(Color.white.opacity(0.04))
                        }
                    } header: {
                        Text(category.title)
                            .foregroundStyle(HT.teal)
                    } footer: {
                        if !category.description.isEmpty {
                            Text(category.description)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(HT.pageGradient.ignoresSafeArea())
            .searchable(text: $search, prompt: "Search topics")
            .navigationTitle("Choose a topic")
            .navigationBarTitleDisplayMode(.inline)
            .frame(maxWidth: HTLayout.isRegularWidth(horizontalSizeClass) ? 640 : .infinity)
            .frame(maxWidth: .infinity)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}
