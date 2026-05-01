import { Box, Button, Env, List, Page, Text } from "../dsl"

type ChatMessage = Record<string, unknown> & {
  id: string
  sender: "peer" | "self" | "system"
  text: string
}

export const ChatAlignmentPage = Page({
  title: "聊天对齐示例",
  env: Env({
    id: "chat-alignment-env",
    layout: "default",
    slots: ["header", "main", "footer"],
  }),
  children: [
    Text({
      text: "聊天对齐示例",
      variant: "title",
      slot: "header",
    }),

    Box({
      title: "消息流",
      slot: "main",
      titleActions: [
        Button({
          text: "模拟新消息",
          variant: "primary",
          onClick: async (ctx) => {
            await ctx.request.post("/api/chat/messages")
            ctx.toast("已生成一条运行时消息", {
              animation: "pop",
              duration: 1800,
              variant: "success",
            })
          },
        }),
      ],
      gap: 12,
      scroll: "y",
      maxHeight: 520,
      childrenAlignX: "stretch",
      childrenAlignY: "top",
      childrenSizeX: "fill",
      children: [
        List<ChatMessage>({
          id: "chat-message-list",
          dataSource: "/api/chat/messages",
          itemKey: "id",
          gap: 12,
          childrenAlignX: "stretch",
          childrenAlignY: "top",
          childrenSizeX: "fill",
          loading: [
            Text({
              text: "正在加载消息...",
              variant: "caption",
            }),
          ],
          empty: [
            Text({
              text: "暂无消息",
              variant: "caption",
            }),
          ],
          renderItem: (message) => {
            const isSelf = message.sender === "self"
            const isSystem = message.sender === "system"

            return Box({
              tone: isSelf ? "accent" : isSystem ? "muted" : "default",
              alignX: isSelf ? "right" : isSystem ? "center" : "left",
              sizeX: "hug",
              padding: isSystem ? "6px 10px" : "8px 12px",
              radius: isSystem ? 999 : 6,
              borderWidth: 0,
              shadow: "none",
              children: [
                Text({
                  text: `${getSenderLabel(message.sender)}：${message.text}`,
                  variant: isSystem ? "caption" : "body",
                  lineHeight: isSystem ? "normal" : "relaxed",
                }),
              ],
            })
          },
        }),
      ],
    }),
  ],
})

function getSenderLabel(sender: ChatMessage["sender"]): string {
  if (sender === "self") {
    return "自己消息"
  }

  if (sender === "system") {
    return "系统消息"
  }

  return "对方消息"
}
