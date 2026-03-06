# 7 Cups Mock API Documentation (Updated)

This document describes the REST API endpoints and Socket.IO events implemented in the mock Node server, incorporating findings from sources, source 2, and source 3.

## Server Details
- **Base URL:** `http://localhost:3000`
- **WebSocket URL:** `ws://localhost:3000`

---

## REST API Endpoints

### Privacy
- **POST `/apiv2/privacy/cmp/choices`**
  - Saves user privacy preferences.
- **GET `/apiv2/privacy/cmp/choices/ui`**
  - Retrieves UI configuration for privacy choices.

### Chat Conversations
- **GET `/chat/conversation/`** (and `/apiv2/chat/conversation/`)
  - Retrieves a list of active conversations and user metadata.
- **GET `/chat/conversation/:convID`** (and `/apiv2/chat/conversation/:convID`)
  - Fetches detailed information for a single conversation.
- **POST `/chat/conversation`** (and `/apiv2/chat/conversation`)
  - Requests a new personal chat conversation.
- **GET `/chat/conversation/:convID/request`**
  - Checks the status of a specific chat request.
- **POST `/chat/conversation/:convID/accept`**
  - Accepts an incoming chat request.
- **POST `/chat/conversation/:convID/decline`**
  - Declines an incoming chat request.
- **PUT `/chat/conversation/:convID`**
  - Updates conversation status.
- **POST `/chat/conversation/:convID/rate`**
  - Rates a listener after a conversation ends.
- **GET `/chat/conversation/:convID/discussion/end`**
  - Ends the current discussion.

### Messages
- **GET `/chat/conversation/:convID/message/`**
  - Retrieves messages and server time.
- **POST `/chat/conversation/:convID/message/`** (and `POST /chat/conversation/:convID/message`)
  - Sends a new message.
- **DELETE `/chat/conversation/:convID/message/:msgHash`**
  - Removes a specific message by hash (moderation).
- **POST `/chat/conversation/:convID/message/:msgHash/heart`**
  - "Hearts" a specific message.
- **POST `/chat/conversation/:convID/message/reaction/:reactionType`**
  - Adds a reaction to a message.

### Helper & Legacy
- **GET `/ajax/issueArray.php`**
  - Returns possible categories (Anxiety, Depression, etc.) for chat requests.
- **GET `/connect/holdRequest.php`**
  - Manages/holds chat requests during certain user flows.
- **GET `/objects/captcha/renderCaptcha.php`**
  - Renders/returns captcha data.

---

## Socket.IO Events

### Client Emit (send)
- **`sendConvAction`**
  - **Actions:** `newMessage`, `typingStatus`, `modRemoveMsg`, `heartMsg`, `endLiveChat`.
- **`addToRooms`**
  - Join specific chat rooms or global channels.
- **`leave`**
  - Leave a room.
- **`subscribeChatRequestQueue`**
  - Subscribes to new incoming chat request updates.

### Server Emit (receive)
- **`recConvAction`**: Broadcasted action from other users.
- **`chatRequestQueueUpdate`**: Updates on the global request queue.
- **`notification`**: General system notifications.
