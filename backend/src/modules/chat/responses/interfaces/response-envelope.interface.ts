export type EnvelopeComponentType = 'chart' | 'table' | 'metrics';

export interface IEnvelopeComponent {
  type: EnvelopeComponentType;
  props: Record<string, unknown>;
}

export interface IResponseEnvelope {
  text?: string;
  components?: IEnvelopeComponent[];
}

export type ToolResultShape = {
  success?: boolean;
  data?: unknown;
  error?: string;
};
