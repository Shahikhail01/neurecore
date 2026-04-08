"use client";

import React, { useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Card,
  Empty,
  Skeleton,
  message,
  Space,
  DatePicker,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useRequest, useAPIClient } from "@/api-client";
import { useCurrentUser } from "@/user";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  priority: "high" | "medium" | "low";
  assignedAgent?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function TasksPage() {
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const currentUser = useCurrentUser();
  const api = useAPIClient();

  // List tasks
  const {
    data: listData,
    loading: listLoading,
    run: refetch,
  } = useRequest(
    {
      resource: "tasks",
      action: "list",
      params: { limit: 100 },
    },
    { manual: false },
  );

  const tasks = listData?.data || [];

  const columns: ColumnsType<Task> = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      width: 200,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => {
        const colors: Record<string, string> = {
          pending: "#faad14",
          in_progress: "#1890ff",
          completed: "#52c41a",
          failed: "#f5222d",
        };
        const labels: Record<string, string> = {
          pending: "Pending",
          in_progress: "In Progress",
          completed: "Completed",
          failed: "Failed",
        };
        return (
          <span style={{ color: colors[status] || "gray" }}>
            {labels[status]}
          </span>
        );
      },
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 100,
      render: (priority: string) => {
        const colors: Record<string, string> = {
          high: "#f5222d",
          medium: "#faad14",
          low: "#52c41a",
        };
        return (
          <span style={{ color: colors[priority] || "gray" }}>{priority}</span>
        );
      },
    },
    {
      title: "Assigned Agent",
      dataIndex: "assignedAgent",
      key: "assignedAgent",
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      width: 120,
      render: (date: string) => (date ? dayjs(date).format("YYYY-MM-DD") : "-"),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: any, record: Task) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditTask(record)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={() => handleDeleteTask(record.id)}
          />
        </Space>
      ),
    },
  ];

  const handleOpenModal = () => {
    setIsEditing(false);
    setEditingId(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setIsEditing(true);
    setEditingId(task.id);
    form.setFieldsValue({
      ...task,
      dueDate: task.dueDate ? dayjs(task.dueDate) : undefined,
    });
    setIsModalOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    Modal.confirm({
      title: "Delete Task",
      icon: <ExclamationCircleOutlined />,
      content: "Are you sure you want to delete this task?",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await api.delete(`/tasks/${taskId}`);
          message.success("Task deleted successfully");
          refetch();
        } catch (err: any) {
          message.error(err.response?.data?.message || "Failed to delete task");
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
      };
      if (isEditing && editingId) {
        await api.put(`/tasks/${editingId}`, data);
        message.success("Task updated successfully");
      } else {
        await api.post("/tasks", data);
        message.success("Task created successfully");
      }
      setIsModalOpen(false);
      form.resetFields();
      refetch();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Operation failed");
    }
  };

  if (listLoading && tasks.length === 0) {
    return (
      <div style={{ padding: "24px" }}>
        <Card>
          <Skeleton active />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      <Card
        title="Tasks"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenModal}
          >
            Add Task
          </Button>
        }
      >
        {tasks.length === 0 ? (
          <Empty description="No tasks found" />
        ) : (
          <Table
            columns={columns}
            dataSource={tasks}
            loading={listLoading}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total: number) => `Total ${total} tasks`,
            }}
          />
        )}
      </Card>

      <Modal
        title={isEditing ? "Edit Task" : "Add Task"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={form.submit}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Title"
            name="title"
            rules={[{ required: true, message: "Please enter task title" }]}
          >
            <Input placeholder="Task title" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea placeholder="Task description" rows={4} />
          </Form.Item>

          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: "Please select status" }]}
          >
            <Select
              options={[
                { label: "Pending", value: "pending" },
                { label: "In Progress", value: "in_progress" },
                { label: "Completed", value: "completed" },
                { label: "Failed", value: "failed" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Priority"
            name="priority"
            rules={[{ required: true, message: "Please select priority" }]}
          >
            <Select
              options={[
                { label: "High", value: "high" },
                { label: "Medium", value: "medium" },
                { label: "Low", value: "low" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Assigned Agent" name="assignedAgent">
            <Input placeholder="Agent name or ID" />
          </Form.Item>

          <Form.Item label="Due Date" name="dueDate">
            <DatePicker />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
