# Voice Calling

## Overview
Enable AI employees to make and receive phone calls. Integrates with telephony providers (Twilio, Vonage, etc.) for voice-based AI interactions including outbound calling, inbound IVR, and voice transcription.

## Category
COMMUNICATION

## Backend Status
- ❌ **No backend implementation exists**
- No telephony provider integration
- No WebRTC or SIP infrastructure

## Tenant Frontend Status
- ❌ **No tenant UI**

## Admin Frontend Status
- ❌ **No admin UI**
- `IntegrationSettings` type does not include voice/calling fields

## AI Employee Integration
- ❌ **No agent tools** — agents cannot make or receive calls

## Package/Tier Integration
- Key: `voice_calling`
- Referenced in accounting packages
- Currently a placeholder flag

## Implementation Gaps
- Full telephony provider integration (Twilio Voice API recommended)
- Outbound calling agent tool
- Inbound call routing and IVR menu builder
- Voice transcription (STT) and AI response generation (TTS)
- Call recording and analytics
- Phone number provisioning and management UI
- Real-time audio streaming for natural conversation
