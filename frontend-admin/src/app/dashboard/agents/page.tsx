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

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: "active" | "inactive" | "archived";
  type?: string;
  config?: any;
  createdAt?: string;
  updatedAt?: string;
}

export default function AgentsPage() {
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const currentUser = useCurrentUser();
  const api = useAPIClient();

  // List agents
  const {
    data: listData,
    loading: listLoading,
    run: refetch,
  } = useRequest(
    {
      resource: "agents",
      action: "list",
      params: { limit: 100 },
    },
    { manual: false },
  );

  const agents = listData?.data || [];

  const columns: ColumnsType<Agent> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 200,
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 120,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => {
        const colors: Record<string, string> = {
          active: "#52c41a",
          inactive: "#f5222d",
          archived: "#bfbfbf",
        };
        return (
          <span style={{ color: colors[status] || "gray" }}>{status}</span>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: any, record: Agent) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditAgent(record)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={() => handleDeleteAgent(record.id)}
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

  const handleEditAgent = (agent: Agent) => {
    setIsEditing(true);
    setEditingId(agent.id);
    form.setFieldsValue(agent);
    setIsModalOpen(true);
  };

  const handleDeleteAgent = (agentId: string) => {
    Modal.confirm({
      title: "Delete Agent",
      icon: <ExclamationCircleOutlined />,
      content: "Are you sure you want to delete this agent?",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await api.delete(`/agents/${agentId}`);
          message.success("Agent deleted successfully");
          refetch();
        } catch (err: any) {
          message.error(
            err.response?.data?.message || "Failed to delete agent",
          );
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      if (isEditing && editingId) {
        await api.put(`/agents/${editingId}`, values);
        message.success("Agent updated successfully");
      } else {
        await api.post("/agents", values);
        message.success("Agent created successfully");
      }
      setIsModalOpen(false);
      form.resetFields();
      refetch();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Operation failed");
    }
  };

  if (listLoading && agents.length === 0) {
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
        title="Agents"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenModal}
          >
            Add Agent
          </Button>
        }
      >
        {agents.length === 0 ? (
          <Empty description="No agents found" />
        ) : (
          <Table
            columns={columns}
            dataSource={agents}
            loading={listLoading}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total: number) => `Total ${total} agents`,
            }}
          />
        )}
      </Card>

      <Modal
        title={isEditing ? "Edit Agent" : "Add Agent"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={form.submit}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Please enter agent name" }]}
          >
            <Input placeholder="Agent name" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea placeholder="Agent description" rows={4} />
          </Form.Item>

          <Form.Item label="Type" name="type">
            <Input placeholder="Agent type" />
          </Form.Item>

          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: "Please select status" }]}
          >
            <Select
              options={[
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
                { label: "Archived", value: "archived" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
