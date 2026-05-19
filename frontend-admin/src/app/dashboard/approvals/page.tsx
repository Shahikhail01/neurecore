"use client";

import React, { useState, useMemo } from "react";
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
  Tabs,
  Tag,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useRequest, useAPIClient } from "@/api-client";
import { useCurrentUser } from "@/user";
import type { ColumnsType } from "antd/es/table";

interface Approval {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "approved" | "rejected" | "changes_requested";
  requestedBy: string;
  approvedBy?: string;
  comments?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function ApprovalsPage() {
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "completed">("pending");
  const currentUser = useCurrentUser();
  const api = useAPIClient();

  // List approvals
  const {
    data: listData,
    loading: listLoading,
    run: refetch,
  } = useRequest(
    {
      resource: "approvals",
      action: "list",
      params: { limit: 100 },
    },
    { manual: false },
  );

  const allApprovals = Array.isArray(listData?.data?.data)
    ? listData.data.data
    : [];

  const pendingApprovals = useMemo(
    () => allApprovals.filter((a) => a.status === "pending"),
    [allApprovals],
  );

  const completedApprovals = useMemo(
    () =>
      allApprovals.filter((a) =>
        ["approved", "rejected", "changes_requested"].includes(a.status),
      ),
    [allApprovals],
  );

  const columns: ColumnsType<Approval> = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      width: 200,
    },
    {
      title: "Requested By",
      dataIndex: "requestedBy",
      key: "requestedBy",
      width: 150,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => {
        const statusMap: Record<string, { color: string; label: string }> = {
          pending: { color: "orange", label: "Pending" },
          approved: { color: "green", label: "Approved" },
          rejected: { color: "red", label: "Rejected" },
          changes_requested: { color: "blue", label: "Changes Requested" },
        };
        const s = statusMap[status];
        return <Tag color={s?.color}>{s?.label}</Tag>;
      },
    },
    {
      title: "Approved By",
      dataIndex: "approvedBy",
      key: "approvedBy",
      width: 150,
      render: (text) => text || "-",
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_: any, record: Approval) => {
        if (filter === "pending" && record.status === "pending") {
          return (
            <Space size="small">
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                Approve
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => handleReject(record.id)}
              >
                Reject
              </Button>
            </Space>
          );
        }
        return (
          <Space size="small">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEditApproval(record)}
            />
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => handleDeleteApproval(record.id)}
            />
          </Space>
        );
      },
    },
  ];

  const handleOpenModal = () => {
    setIsEditing(false);
    setEditingId(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEditApproval = (approval: Approval) => {
    setIsEditing(true);
    setEditingId(approval.id);
    form.setFieldsValue(approval);
    setIsModalOpen(true);
  };

  const handleApprove = async (approvalId: string) => {
    try {
      await api.put(`/approvals/${approvalId}`, {
        status: "approved",
        approvedBy: currentUser?.id,
      });
      message.success("Approval granted");
      refetch();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to approve");
    }
  };

  const handleReject = async (approvalId: string) => {
    Modal.confirm({
      title: "Reject Approval",
      content: "Please provide comments for rejection:",
      input: <Input.TextArea placeholder="Rejection reason" />,
      onOk: async (comments) => {
        try {
          await api.put(`/approvals/${approvalId}`, {
            status: "rejected",
            approvedBy: currentUser?.id,
            comments,
          });
          message.success("Approval rejected");
          refetch();
        } catch (err: any) {
          message.error(err.response?.data?.message || "Failed to reject");
        }
      },
    });
  };

  const handleDeleteApproval = (approvalId: string) => {
    Modal.confirm({
      title: "Delete Approval",
      icon: <ExclamationCircleOutlined />,
      content: "Are you sure you want to delete this approval?",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await api.delete(`/approvals/${approvalId}`);
          message.success("Approval deleted successfully");
          refetch();
        } catch (err: any) {
          message.error(
            err.response?.data?.message || "Failed to delete approval",
          );
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      if (isEditing && editingId) {
        await api.put(`/approvals/${editingId}`, values);
        message.success("Approval updated successfully");
      } else {
        await api.post("/approvals", values);
        message.success("Approval created successfully");
      }
      setIsModalOpen(false);
      form.resetFields();
      refetch();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Operation failed");
    }
  };

  if (listLoading && allApprovals.length === 0) {
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
        title="Approvals"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenModal}
          >
            New Approval
          </Button>
        }
      >
        <Tabs
          activeKey={filter}
          onChange={(key) => setFilter(key as "pending" | "completed")}
          items={[
            {
              key: "pending",
              label: `Pending (${pendingApprovals.length})`,
              children: (
                <div>
                  {pendingApprovals.length === 0 ? (
                    <Empty description="No pending approvals" />
                  ) : (
                    <Table
                      columns={columns}
                      dataSource={pendingApprovals}
                      loading={listLoading}
                      rowKey="id"
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} approvals`,
                      }}
                    />
                  )}
                </div>
              ),
            },
            {
              key: "completed",
              label: `Completed (${completedApprovals.length})`,
              children: (
                <div>
                  {completedApprovals.length === 0 ? (
                    <Empty description="No completed approvals" />
                  ) : (
                    <Table
                      columns={columns}
                      dataSource={completedApprovals}
                      loading={listLoading}
                      rowKey="id"
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} approvals`,
                      }}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={isEditing ? "Edit Approval" : "Create Approval"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={form.submit}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Title"
            name="title"
            rules={[{ required: true, message: "Please enter approval title" }]}
          >
            <Input placeholder="Approval title" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea placeholder="Approval description" rows={4} />
          </Form.Item>

          <Form.Item
            label="Requested By"
            name="requestedBy"
            rules={[{ required: true, message: "Please enter requester name" }]}
          >
            <Input placeholder="Requester name or ID" />
          </Form.Item>

          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: "Please select status" }]}
          >
            <Select
              options={[
                { label: "Pending", value: "pending" },
                { label: "Approved", value: "approved" },
                { label: "Rejected", value: "rejected" },
                { label: "Changes Requested", value: "changes_requested" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Comments" name="comments">
            <Input.TextArea placeholder="Additional comments" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
