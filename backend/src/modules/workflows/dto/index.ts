/**
 * Workflows DTOs — barrel export.
 *
 * SOLID — Interface Segregation: consumers import only what they need.
 */

export { CreateWorkflowDto } from './create-workflow.dto';
export { UpdateWorkflowDto } from './update-workflow.dto';
export {
  WorkflowResponseDto,
  WorkflowExecutionSummaryDto,
} from './workflow-response.dto';
export { UpdateWorkflowExecutionDto } from './workflow-response.dto';
