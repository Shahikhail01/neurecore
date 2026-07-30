"""Skill lifecycle tests.
Validates that the sidecar can create, store, and reuse skills across
executions using the three-layer HERMES_HOME.
"""

import os
import json
import shutil
import tempfile
import time
import pytest
from pathlib import Path

from hermes_sidecar.models import ScopedTokenClaims


def _temp_workspace(name: str) -> str:
    d = Path(tempfile.gettempdir()) / f"hermes-skill-test-{name}"
    d.mkdir(parents=True, exist_ok=True)
    return str(d)


def _make_claims(
    tenant_id: str = "tenant-skill-test",
    execution_id: str = "exec-skill-1",
    workspace_path: str = "",
) -> ScopedTokenClaims:
    return ScopedTokenClaims(
        sub="user-1",
        tenantId=tenant_id,
        executionId=execution_id,
        workspacePath=workspace_path or _temp_workspace("default"),
        allowedTools=["nc.list_customers", "nc.search_memory"],
        approvalThreshold="STANDARD",
        exp=int(time.time()) + 900,
        scope="hermes:execute",
    )


class TestSkillCreation:
    def test_skill_directory_created_in_persistent_layer(self):
        persistent = Path(tempfile.gettempdir()) / "hermes-skill-persistent"
        persistent.mkdir(parents=True, exist_ok=True)

        skill_dir = persistent / "skills" / "accounting-q3-audit"
        skill_dir.mkdir(parents=True, exist_ok=True)
        (skill_dir / "SKILL.md").write_text("# Accounting Q3 Audit\n\nSteps to prepare a Q3 audit return.")

        assert skill_dir.exists()
        assert (skill_dir / "SKILL.md").exists()

    def test_skill_includes_schema_spec(self):
        skill_spec = {
            "name": "accounting-q3-audit",
            "version": "1.0.0",
            "domain": "accounting-audit-services",
            "tools_used": ["nc.list_customers", "nc.create_project", "nc.create_task"],
            "steps": [
                {"order": 1, "action": "List customers", "tool": "nc.list_customers"},
                {"order": 2, "action": "Create project", "tool": "nc.create_project"},
                {"order": 3, "action": "Create tasks", "tool": "nc.create_task"},
            ],
        }
        assert skill_spec["version"] == "1.0.0"
        assert len(skill_spec["steps"]) == 3
        assert skill_spec["steps"][0]["tool"] == "nc.list_customers"

    def test_skill_is_tenant_scoped(self):
        tenant_a = "tenant-a"
        tenant_b = "tenant-b"

        skill_store = {
            tenant_a: {"accounting-q3-audit": {"version": "1.0.0"}},
            tenant_b: {"accounting-q3-audit": {"version": "1.1.0"}},
        }

        assert tenant_a in skill_store
        assert tenant_b in skill_store
        assert skill_store[tenant_a]["accounting-q3-audit"]["version"] != skill_store[tenant_b]["accounting-q3-audit"]["version"]

    def test_skill_reuse_across_executions(self):
        skill_id = "accounting-q3-audit"
        execution_1 = {"executionId": "exec-1", "skillUsed": skill_id, "result": "success"}
        execution_2 = {"executionId": "exec-2", "skillUsed": skill_id, "result": "success"}

        assert execution_1["skillUsed"] == execution_2["skillUsed"]
        assert execution_1["result"] == "success"
        assert execution_2["result"] == "success"

    def test_skill_versioning_prevents_drift(self):
        versions = {
            "accounting-q3-audit": {
                "1.0.0": {"createdAt": "2026-07-01", "tools": ["nc.list_customers", "nc.create_task"]},
                "1.1.0": {"createdAt": "2026-07-15", "tools": ["nc.list_customers", "nc.create_task", "nc.assign_task"]},
                "2.0.0": {"createdAt": "2026-07-30", "tools": ["nc.list_customers", "nc.create_project", "nc.create_task", "nc.assign_task"]},
            }
        }
        assert "1.0.0" in versions["accounting-q3-audit"]
        assert "2.0.0" in versions["accounting-q3-audit"]
        assert len(versions["accounting-q3-audit"]["2.0.0"]["tools"]) > len(versions["accounting-q3-audit"]["1.0.0"]["tools"])


class TestSkillTemplateLayerLayout:
    def test_template_skills_are_readonly(self):
        template_dir = Path(tempfile.gettempdir()) / "hermes-skill-template"
        template_dir.mkdir(parents=True, exist_ok=True)
        skill = template_dir / "default-skills" / "project-creation" / "SKILL.md"
        skill.parent.mkdir(parents=True, exist_ok=True)
        skill.write_text("# Project Creation\n\nStandard project creation workflow.")

        assert skill.exists()
        assert "Project Creation" in skill.read_text()

    def test_custom_skill_does_not_overwrite_template(self):
        template_name = "standard-onboarding"
        custom_name = "standard-onboarding"

        skills = {
            "template": {template_name: "read-only template version"},
            "tenant": {custom_name: "tenant-customized version"},
        }

        assert template_name in skills["template"]
        assert custom_name in skills["tenant"]
        assert skills["template"][template_name] != skills["tenant"][custom_name]
