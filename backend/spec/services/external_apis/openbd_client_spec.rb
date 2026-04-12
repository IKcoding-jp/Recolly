# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe ExternalApis::OpenbdClient, type: :service do
  subject(:client) { described_class.new }

  describe '#fetch' do
    context 'ISBNが空の場合' do
      it 'nil を返す' do
        expect(client.fetch(nil)).to be_nil
        expect(client.fetch('')).to be_nil
      end
    end

    context '正常なレスポンスの場合' do
      let(:valid_response) do
        [
          {
            'summary' => {
              'isbn' => '9784101001340',
              'title' => '人間失格',
              'cover' => 'https://cover.openbd.jp/9784101001340.jpg'
            },
            'onix' => {
              'CollateralDetail' => {
                'TextContent' => [
                  { 'TextType' => '03', 'Text' => '恥の多い生涯を送って来ました。' },
                  { 'TextType' => '02', 'Text' => '著者: 太宰治' }
                ]
              }
            }
          }
        ]
      end

      before do
        stub_request(:get, %r{api.openbd.jp/v1/get})
          .to_return(status: 200, body: valid_response.to_json,
                     headers: { 'Content-Type' => 'application/json' })
      end

      it '画像URLと内容紹介を返す' do
        result = client.fetch('9784101001340')
        expect(result[:cover_image_url]).to eq('https://cover.openbd.jp/9784101001340.jpg')
        expect(result[:description]).to eq('恥の多い生涯を送って来ました。')
      end

      it 'TextType=03（内容紹介）を優先して選ぶ' do
        result = client.fetch('9784101001340')
        expect(result[:description]).to eq('恥の多い生涯を送って来ました。')
        expect(result[:description]).not_to include('著者')
      end
    end

    context 'ISBNが見つからない場合' do
      before do
        # openBDは該当なしの時 [null] を返す
        stub_request(:get, %r{api.openbd.jp/v1/get})
          .to_return(status: 200, body: [nil].to_json,
                     headers: { 'Content-Type' => 'application/json' })
      end

      it 'nil を返す' do
        expect(client.fetch('9999999999999')).to be_nil
      end
    end

    context '画像が欠損している場合' do
      let(:partial_response) do
        [{
          'summary' => { 'isbn' => '9784101001340', 'title' => 'テスト' },
          'onix' => {
            'CollateralDetail' => {
              'TextContent' => [{ 'TextType' => '03', 'Text' => '説明文' }]
            }
          }
        }]
      end

      before do
        stub_request(:get, %r{api.openbd.jp/v1/get})
          .to_return(status: 200, body: partial_response.to_json,
                     headers: { 'Content-Type' => 'application/json' })
      end

      it '画像URLは nil、説明は返す' do
        result = client.fetch('9784101001340')
        expect(result[:cover_image_url]).to be_nil
        expect(result[:description]).to eq('説明文')
      end
    end

    context 'ネットワークエラーの場合' do
      before do
        stub_request(:get, %r{api.openbd.jp/v1/get}).to_timeout
      end

      it 'nil を返しエラーを握りつぶす' do
        expect(client.fetch('9784101001340')).to be_nil
      end
    end
  end
end
