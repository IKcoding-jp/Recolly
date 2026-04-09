# frozen_string_literal: true

require 'rails_helper'

RSpec.describe GoogleIdTokenVerifier do
  let(:credential) { 'dummy.jwt.token' }
  let(:client_id) { 'test-client-id.apps.googleusercontent.com' }
  let(:valid_payload) do
    {
      'sub' => '1234567890',
      'email' => 'user@example.com',
      'name' => 'Test User',
      'aud' => client_id,
      'iss' => 'https://accounts.google.com',
      'exp' => 1.hour.from_now.to_i
    }
  end

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOOGLE_CLIENT_ID').and_return(client_id)
  end

  describe '#call' do
    context '有効なID Tokenが渡されたとき' do
      before do
        allow(Google::Auth::IDTokens).to receive(:verify_oidc)
          .with(credential, aud: client_id)
          .and_return(valid_payload)
      end

      it 'sub, email, nameを含むハッシュを返す' do
        result = described_class.new(credential: credential).call
        expect(result).to eq(
          sub: '1234567890',
          email: 'user@example.com',
          name: 'Test User'
        )
      end

      it 'GOOGLE_CLIENT_IDをaudienceとして渡す' do
        described_class.new(credential: credential).call
        expect(Google::Auth::IDTokens).to have_received(:verify_oidc).with(credential, aud: client_id)
      end
    end

    context 'nameが含まれていないID Tokenのとき' do
      let(:payload_without_name) { valid_payload.except('name') }

      before do
        allow(Google::Auth::IDTokens).to receive(:verify_oidc).and_return(payload_without_name)
      end

      it 'nameはnilで返る' do
        result = described_class.new(credential: credential).call
        expect(result[:name]).to be_nil
        expect(result[:sub]).to eq('1234567890')
      end
    end

    context '署名検証に失敗したとき' do
      before do
        allow(Google::Auth::IDTokens).to receive(:verify_oidc)
          .and_raise(Google::Auth::IDTokens::SignatureError.new('invalid signature'))
      end

      it 'SignatureErrorが伝播する' do
        expect { described_class.new(credential: credential).call }
          .to raise_error(Google::Auth::IDTokens::SignatureError)
      end
    end

    context 'audienceが一致しないとき' do
      before do
        allow(Google::Auth::IDTokens).to receive(:verify_oidc)
          .and_raise(Google::Auth::IDTokens::AudienceMismatchError.new('wrong audience'))
      end

      it 'AudienceMismatchErrorが伝播する' do
        expect { described_class.new(credential: credential).call }
          .to raise_error(Google::Auth::IDTokens::AudienceMismatchError)
      end
    end

    context '有効期限が切れているとき' do
      before do
        allow(Google::Auth::IDTokens).to receive(:verify_oidc)
          .and_raise(Google::Auth::IDTokens::ExpiredTokenError.new('expired'))
      end

      it 'ExpiredTokenErrorが伝播する' do
        expect { described_class.new(credential: credential).call }
          .to raise_error(Google::Auth::IDTokens::ExpiredTokenError)
      end
    end

    context 'credentialがnilまたは空文字のとき' do
      it 'nilならArgumentErrorを raise する' do
        expect { described_class.new(credential: nil).call }
          .to raise_error(ArgumentError, /credential/)
      end

      it '空文字ならArgumentErrorを raise する' do
        expect { described_class.new(credential: '').call }
          .to raise_error(ArgumentError, /credential/)
      end
    end
  end
end
