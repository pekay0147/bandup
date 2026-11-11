# 밴드업 아이폰 앱 (앱스토어 없이 설치)

밴드업 웹앱을 그대로 감싼 아이폰 앱이에요. 앱에 `bandup://` 주소가 있어서,
단축어 마지막 동작을 **URL 열기 → `bandup://`** 로 바꾸면 뒷면 탭 → 화면 저장 → **이 앱이 바로 열려요.**

## 준비물
- 맥 + Xcode (App Store에서 무료)
- 애플 ID (무료 계정이면 7일마다 다시 설치, 개발자 계정 $99/년이면 1년)
- 은수님 아이폰 + 케이블

## 설치 순서 (처음 한 번, 약 15분)
1. 맥 터미널에서:
   ```
   brew install xcodegen
   git clone https://github.com/pekay0147/bandup.git
   cd bandup/ios
   xcodegen
   open Bandup.xcodeproj
   ```
2. Xcode 왼쪽 **Bandup** → **Signing & Capabilities**
   - Team: 내 애플 ID 선택 (없으면 Add Account…)
   - Bundle Identifier: 무료 계정이면 `com.내이름.bandup` 처럼 남과 겹치지 않게
3. 아이폰을 케이블로 연결 → 위쪽 기기 목록에서 아이폰 선택 → ▶ (Run)
4. 아이폰: 설정 → 일반 → VPN 및 기기 관리 → 내 애플 ID → **신뢰**
   (iOS 16 이상은 설정 → 개인정보 보호 및 보안 → **개발자 모드** 켜기 → 재시동)
5. 밴드업 앱이 열리면 홈 → 계정 · 기록 저장 → 같은 이메일로 로그인 (기록이 그대로 들어와요)

## 단축어 바꾸기
단축어 앱 → 밴드업 단축어 → 마지막 **Open URLs** 칸의 주소를 `bandup://` 로 바꾸기.
이제 뒷면 두 번 톡톡 → 화면 저장 → 밴드업 앱이 열리면서 방금 찍은 화면이 떠요.

## 다른 회원 폰에 깔 때
`Bandup/Info.plist`의 `BandupSlug`를 그 회원 코드로 바꾸거나,
설치 후 사파리 주소창에 `bandup://u/회원코드` 를 한 번 열면 그 회원 앱으로 바뀌어요.
