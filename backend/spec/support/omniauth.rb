# frozen_string_literal: true

OmniAuth.config.test_mode = true

RSpec.configure do |config|
  config.before do
    OmniAuth.config.mock_auth[:google_oauth2] = nil
  end
end

def mock_google_oauth(email: 'user@gmail.com', uid: 'google_12345', name: 'Test User')
  OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
    provider: 'google_oauth2',
    uid: uid,
    info: { email: email, name: name, image: 'https://example.com/avatar.jpg' }
  )
end
