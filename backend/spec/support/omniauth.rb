# frozen_string_literal: true

OmniAuth.config.test_mode = true

RSpec.configure do |config|
  config.before do
    OmniAuth.config.mock_auth[:google_oauth2] = nil
    OmniAuth.config.mock_auth[:twitter2] = nil
  end
end

def mock_google_oauth(email: 'user@gmail.com', uid: 'google_12345', name: 'Test User')
  OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
    provider: 'google_oauth2',
    uid: uid,
    info: { email: email, name: name, image: 'https://example.com/avatar.jpg' }
  )
end

def mock_twitter_oauth(uid: 'twitter_67890', name: 'TwitterUser', email: nil)
  OmniAuth.config.mock_auth[:twitter2] = OmniAuth::AuthHash.new(
    provider: 'twitter2',
    uid: uid,
    info: { email: email, name: name, image: 'https://example.com/avatar.jpg' }
  )
end
