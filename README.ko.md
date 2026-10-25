# claude-account-switch

[![npm version](https://img.shields.io/npm/v/claude-account-switch)](https://www.npmjs.com/package/claude-account-switch)
[![license](https://img.shields.io/npm/l/claude-account-switch)](./LICENSE)

`CLAUDE_CONFIG_DIR`로 [Claude Code 계정](https://code.claude.com/docs/en/iam#log-in-with-multiple-accounts)을 전환합니다. 실행에 필요한 외부 패키지는 없습니다.

[English](./README.md) · [전체 가이드](https://ftery0.github.io/claude-account-switch/ko/guide/)

이 README는 저장소 소스 기준입니다. 새 `cpf` 관리 메뉴와 이름 변경은 이 소스 또는 해당 기능이 포함된 배포 버전이 필요합니다. `@latest`는 현재 npm에 배포된 패키지를 설치합니다. 이 소스를 셸에 반영하는 방법은 [기존 사용자](#기존-사용자)를 참고하세요.

## 시작

Node.js 18.19+ (18계열) 또는 20.10+와 기존 Claude Code 설치를 사용합니다. Claude Code가 없다면 [공식 설치 가이드](https://code.claude.com/docs/en/setup)를 따릅니다.

```bash
npx claude-account-switch@latest init
```

프로필 이름(예: `work`, `personal`)을 정하고 기존 설정 하나를 가져올지 선택한 뒤, 새 터미널을 엽니다. `init`은 첫 설정용이며, 다시 실행하면 현재 설정만 보여줍니다.

## 평소에는 두 명령만

`cpf`와 `claude`는 **터미널의 셸 프롬프트**(`%` 또는 `$`)에서 실행합니다. Claude 채팅창에 들어가 있다면 먼저 그곳에 `/exit`를 입력하고 터미널 프롬프트가 나올 때까지 기다립니다.

1. 터미널에서 `cpf`를 실행하면 조회·전환·추가·이름 변경·삭제·종료 메뉴가 열립니다.
2. ↑/↓와 Enter로 선택합니다. 작업을 마치면 Exit를 선택해 Claude 실행 없이 터미널로 돌아옵니다.
3. 터미널에서 `claude`를 실행하고 프로필을 고릅니다. Claude가 요청하면 로그인합니다.

바로 실행하고 싶을 때는 다음 명령을 사용합니다.

| 명령 | 하는 일 |
| --- | --- |
| `cpf work` | `work`를 활성 프로필로 지정 |
| `cpf --list` | 전체 프로필과 현재 활성 프로필 확인 |
| `cpf add work2` | `work2` 프로필 추가 |
| `cpf rename wrok2 work2` | `wrok2`를 `work2`로 이름 변경 |
| `cpf remove work2` | 확인 후 `work2` 삭제 |
| `cpf --help` | 명령어 사용법 확인 |

예시의 이름은 본인의 프로필 이름으로 바꿉니다. 이름 하나만 쓰면 항상 해당 프로필로 전환합니다. `cpf add`, `cpf rename`, `cpf remove`, `cpf list`도 각각 그 이름의 프로필로 전환하므로, 목록 조회는 `cpf --list`를 사용합니다.

프로필이 여러 개이면 대화형 터미널의 `claude` 실행 시 현재 활성 프로필에서 시작하는 선택기가 나옵니다. 스크립트에서는 선택기 없이 활성 프로필을 사용합니다. `--help`, `--version`을 포함한 Claude 인자는 그대로 전달됩니다. 전환은 이후 실행에 적용되며, 이미 실행 중인 Claude 세션은 기존 프로필과 계정을 유지합니다.

## 계정 하나 더 추가하기

1. 터미널에서 프로필을 만듭니다.

   ```bash
   cpf add work2
   ```

2. 터미널에서 Claude를 실행합니다.

   ```bash
   claude
   ```

3. 선택기에서 `work2`를 고르고, Claude가 요청하면 사용할 계정으로 로그인합니다.

프로필을 만드는 것만으로 전환되거나 로그인되지는 않습니다. 명령을 외우지 않고 `cpf` 메뉴에서 추가해도 됩니다.

## 원래 쓰던 기본 계정 가져오기

프로필로 가져오지 않고 원래 Claude CLI를 실행하려면 Bash/zsh 터미널에서 `command claude`로 실행 함수를 우회할 수 있습니다. Claude의 기본 설정을 사용하되, `CLAUDE_CONFIG_DIR`을 따로 설정했다면 해당 경로를 사용합니다.

프로필을 만드는 것만으로 기본 `~/.claude` 설정이 자동 이관되거나 로그인되지는 않습니다. 처음 `init`을 실행할 때 해당 원본과 대상 프로필을 고를 수 있습니다. 이미 프로필이 있으면 `init`은 요약만 보여주므로 별도로 이관합니다.

1. 원본 또는 대상 프로필을 사용하는 Claude 세션마다 `/exit`를 입력해 종료하고 터미널로 돌아옵니다.
2. `cpf --list`로 대상 프로필을 고릅니다. 새로 필요하면 `cpf add work`로 만듭니다.
3. 터미널의 이 저장소 루트에서 아래 명령을 실행하고 복사를 확인합니다.

   ```bash
   node bin/cli.mjs migrate work --from ~/.claude
   ```

4. 터미널에서 `claude`를 실행하고 `work`를 선택합니다. 요청하면 로그인합니다. 예시의 `work`는 고른 프로필 이름으로 바꿉니다.

원본 `~/.claude`와 `~/.claude.json`은 그대로 보존합니다. 기존 대상 데이터를 교체한 경우에도 이전 데이터는 성공 후 표시되는 백업 경로에 남깁니다. 대상 데이터 충돌이나 복사 중 대상 변경을 감지하면 이관을 중단합니다. macOS Keychain 인증은 복사하지 않으므로 설정을 가져와도 다시 로그인해야 할 수 있습니다. [자세한 이관 안내](https://ftery0.github.io/claude-account-switch/ko/guide/commands#기존-설정-가져오기)를 참고하세요.

## 프로필 이름 잘못 썼을 때

이름을 바꿀 프로필을 사용하는 Claude 세션을 모두 종료한 뒤 실행합니다. 예를 들어 `wrok2` 오타를 고치려면:

```bash
cpf rename wrok2 work2
```

대화 기록·설정·목록 순서·활성 상태를 보존합니다. `work2`가 이미 있으면 중단합니다. 설정 경로가 바뀌므로 macOS에서는 다시 로그인해야 할 수 있습니다. 이름을 바꾼 뒤 새 Claude 세션을 실행하세요.

## 같이 쓸 것과 따로 쓸 것

기본으로는 `settings.json`과 `commands`만 모든 프로필이 함께 씁니다. 나머지는 프로필마다 따로입니다. 함께 쓰고 싶은 항목은 `cpf share add`로 추가합니다.

```bash
cpf share                  # 무엇을 같이 쓰는지, 프로필별로 맞는지 보기
cpf share add CLAUDE.md    # 지금 프로필의 CLAUDE.md를 모든 프로필이 같이 씀
cpf share add skills       # 개인 스킬을 하나씩 같이 씀
cpf share remove skills    # 그만 같이 씀 — 각 프로필에 복사본이 남음
cpf share sync             # _shared에 새로 넣은 항목을 지금 바로 연결
```

| 같이 쓸 수 있는 것 | 늘 프로필마다 따로 |
| --- | --- |
| `CLAUDE.md` `keybindings.json` `skills` `agents` `rules` `hooks` `output-styles` `workflows` `themes` | 로그인·`.claude.json`(MCP 서버·프로젝트 신뢰), 대화 기록, `projects`, 플러그인, `skills/synced`(계정에서 내려온 스킬) |

- 같이 쓰는 원본은 `~/.claude-profiles/_shared/<항목>`에 있고, 각 프로필에는 링크가 놓입니다. `_shared/CLAUDE.md`를 다른 파일로 가는 링크로 바꿔도 됩니다.
- 처음 추가할 때 `_shared`에 없으면 지금 프로필의 내용을 복사해 옵니다.
- `claude`로 실행할 때와 새 프로필을 만들 때 링크를 다시 맞춥니다. 내용이 다른 파일이 이미 있으면 지우지 않고 경고만 합니다. 옮기거나 지운 뒤 `cpf share sync`를 실행하세요.
- `skillOverrides`·`enabledMcpjsonServers` 같은 설정은 공유 `settings.json`에 넣으면 모든 프로필에 적용됩니다. MCP 서버 등록과 로그인은 프로필마다 `claude mcp add`·`/mcp`로 합니다.

## 기존 사용자

이 저장소의 변경을 사용하려면 **저장소 루트에서** 다음 명령을 실행하고 새 터미널을 엽니다.

```bash
node bin/cli.mjs install-shell
```

npm 배포 버전의 셸 명령어와 로컬 실행 파일을 설치·복구·갱신하려면 아래 명령을 사용하고 새 터미널을 엽니다.

```bash
npx claude-account-switch@latest install-shell
```

`install-shell`은 프로필 추가나 로그인을 하지 않습니다. 기존 셸의 `cpf`에서 새 관리 명령을 쓰려면 먼저 갱신해야 합니다. 1.x 사용자도 로컬 실행 파일을 사용하도록 `install-shell`을 한 번 실행합니다. 기존 `claude-pick`은 Claude 실행 없이 활성 프로필을 고르는 명령으로 계속 지원합니다.

셸은 `~/.claude-profiles/_runtime`을 사용하므로 일상적인 사용에 글로벌 설치나 임시 npx 캐시가 필요하지 않습니다. Node.js·npm·Claude Code는 계속 설치되어 있어야 합니다.

대화형 Claude 실행 시 하루 한 번 백그라운드에서 이 도구의 새 버전을 확인합니다. 검증된 호환 버전은 다음 실행부터 사용하며, 실행 중인 세션의 파일·계정 데이터·하네스 훅·셸 설정 파일을 덮어쓰지 않습니다. 오프라인이나 다운로드 실패 시 기존 버전으로 계속 실행합니다. 비대화형 실행에서는 자동 업데이트하지 않습니다.

`CLAUDE_SWITCH_DISABLE_AUTO_UPDATE=1`로 자동 업데이트를 끌 수 있습니다. 배포 버전으로 즉시 갱신하려면 `npx claude-account-switch@latest update`를 실행하고, 설치 없이 확인하려면 `--check`를 붙입니다. 글로벌 npm 설치본과 셸 실행 파일은 별개이며, 자동 업데이트는 셸 실행 파일만 갱신합니다. 실행 중인 세션 보호를 위해 이전 실행 파일은 보존합니다.

## 전체 CLI 명령어

아래 명령은 저장소 루트에서 소스를 직접 실행합니다. 배포 버전을 쓸 때는 `node bin/cli.mjs`를 `npx claude-account-switch@latest`로 바꿉니다. 글로벌 설치를 했다면 `claude-account-switch`를 사용할 수 있습니다.

| 명령 | 용도 |
| --- | --- |
| `node bin/cli.mjs manage` | `cpf`와 같은 관리 메뉴 열기 |
| `node bin/cli.mjs manage --list` | 관리 명령으로 프로필 조회 |
| `node bin/cli.mjs init` | 첫 설정 또는 기존 설정 요약 |
| `node bin/cli.mjs add work2` | 프로필 추가 |
| `node bin/cli.mjs rename wrok2 work2` | 프로필 이름 변경 |
| `node bin/cli.mjs remove work2` | 확인 후 프로필 삭제 |
| `node bin/cli.mjs list` | 프로필과 활성 상태 조회 |
| `node bin/cli.mjs use work` | 활성 프로필 변경 |
| `node bin/cli.mjs migrate work --from ~/.claude` | 기존 설정을 안전하게 복사 |
| `node bin/cli.mjs install-shell` | 셸 명령어·로컬 실행 파일 설치·복구·갱신 |
| `node bin/cli.mjs update --check` | 배포된 새 버전을 설치 없이 확인 |
| `node bin/cli.mjs update` | 로컬 실행 파일 갱신 |
| `node bin/cli.mjs share add skills` | 개인 스킬을 모든 프로필이 같이 씀 |
| `node bin/cli.mjs mcp list` | 과거 MCP 이름과 전환 안내 조회 |
| `node bin/cli.mjs rename --help` | 파일 변경 없이 해당 명령의 도움말 확인 |

이관은 원본을 보존하며 데이터가 충돌하면 멈춥니다. 스킬·에이전트·규칙·훅·`CLAUDE.md`는 선택한 프로필에 보존됩니다. macOS Keychain 인증은 복사하지 않아 새 프로필에서 로그인할 수 있습니다. [이관·호환 안내](https://ftery0.github.io/claude-account-switch/ko/guide/commands)를 참고하세요.

2 버전부터 별도 MCP 편집기와 Claude 설치 관리를 없앴습니다. 공식 `claude mcp`와 Claude의 [업데이트 방식](https://code.claude.com/docs/en/setup#update-manually)을 사용합니다. 과거 MCP 파일은 그대로 보존하며 자동 업데이트는 이 도구만 대상으로 하며 Claude Code는 갱신하지 않습니다.

플랫폼 가이드: [macOS](docs/setup-macos.ko.md) · [Linux](docs/setup-linux.ko.md) · [Windows](docs/setup-windows.ko.md)

[MIT](./LICENSE)
