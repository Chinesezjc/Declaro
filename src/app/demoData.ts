export type StudentRow = {
  id: string
  name: string
  skills: string
  groupName: string
  status: string
}

export type ApplicationRow = {
  id: string
  studentName: string
  groupName: string
  reason: string
}

export type ChatMessage = {
  id: string
  sender: "peer" | "self" | "system"
  text: string
}

export const initialStudents: StudentRow[] = [
  { id: "stu-001", name: "李明", skills: "React, UI", groupName: "A 组", status: "已组队" },
  { id: "stu-002", name: "王雨", skills: "Node.js, 数据库", groupName: "B 组", status: "待确认" },
  { id: "stu-003", name: "陈晨", skills: "算法, 可视化", groupName: "未分组", status: "待组队" },
]

export const initialApplications: ApplicationRow[] = [
  { id: "app-001", studentName: "赵青", groupName: "A 组", reason: "熟悉前端交互和报告整理" },
  { id: "app-002", studentName: "周岚", groupName: "B 组", reason: "希望承担后端接口和数据建模" },
]

export const initialChatMessages: ChatMessage[] = [
  { id: "msg-001", sender: "system", text: "你们已进入 HCI 项目讨论群" },
  { id: "msg-002", sender: "peer", text: "我先把低保真原型传上来，你看一下信息架构有没有问题。" },
  { id: "msg-003", sender: "self", text: "收到，我重点看导航、任务流和表单反馈。" },
  { id: "msg-004", sender: "system", text: "张老师加入了聊天" },
  { id: "msg-005", sender: "peer", text: "表格区域如果内容多，是填满父容器还是只包住内容？" },
  { id: "msg-006", sender: "self", text: "聊天气泡用 hug，消息列表里的行容器用 fill，这样左右对齐会很清楚。" },
]

export const generatedChatMessages: Array<Omit<ChatMessage, "id">> = [
  { sender: "peer", text: "运行时追加：我这里又补了一条对方消息。" },
  { sender: "self", text: "运行时追加：这条会自动靠右，并且气泡只包住文本。" },
  { sender: "system", text: "运行时追加：系统通知会居中显示" },
]
