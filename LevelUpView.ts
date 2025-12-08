import * as hz from "horizon/core";
import { Events } from "Events";

import {
  UIComponent,
  View,
  Text,
  Pressable,
  Binding,
  AnimatedBinding,
  Animation,
  Easing,
  Image,
  ImageSource,
} from "horizon/ui";

// Horizon 스크립트 환경에서 setTimeout 타입 정의 보완
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): number;

type CardAssetProps = {
  clickSound: hz.Entity | undefined;
  // 유형별 배경/아이콘 (타입 기반 매핑)
  bgMelee: hz.Asset | undefined;
  bgRange: hz.Asset | undefined;
  bgMagic: hz.Asset | undefined;
  bgDefense: hz.Asset | undefined;
  bgHealth: hz.Asset | undefined;
  iconMelee: hz.Asset | undefined;
  iconRange: hz.Asset | undefined;
  iconMagic: hz.Asset | undefined;
  iconDefense: hz.Asset | undefined;
  iconHealth: hz.Asset | undefined;
};

export class LevelUpView extends UIComponent<CardAssetProps> {  
   // Screen Overlay 타입이므로 panelHeight/Width는 생략 가능하지만 명시해 둠.
   panelHeight = 1080;
   panelWidth = 1920;
 
  // 스킬 유형(5종)과 최대 레벨(10단계)
  private skillTypes = ["Melee", "Range", "Magic", "Defense", "Health"];
  private maxLevel = 10;
  private currentChoices: Array<{ type: string; level: number }> = [];
  private ownerPlayerId: number = -1;
  private currentBackgrounds: Array<hz.Asset | undefined> = [undefined, undefined, undefined];
  private currentIcons: Array<hz.Asset | undefined> = [undefined, undefined, undefined];
  // 카드별 유형별 가시성 토글 (배경/아이콘)
  private bgDisplays: Binding<string>[][] = [];
  private iconDisplays: Binding<string>[][] = [];
  private overlayDisplay = new Binding<string>("flex");
   private skillDesc: Record<string, string> = {
     Melee: "Melee Attack Level +",
     Range: "Range Attack Level +",
     Magic: "Magic Attack Level +",
     Defense: "Defense Level +",
     Health: "HP + % Max HP",
   };
   // 더미 효과 테이블: 유형별 1~10레벨 효과 수치 (필요시 외부 데이터로 대체)
   private skillLevelEffects: Record<string, number[]> = {
     Melee:   [5, 7, 9, 11, 14, 17, 20, 24, 28, 33],
     Range:   [4, 6, 8, 10, 12, 15, 18, 22, 26, 30],
     Magic:   [6, 9, 12, 15, 19, 23, 28, 34, 40, 47],
     Defense: [2, 3, 4, 5, 6, 8, 10, 12, 14, 16],
     Health: [3, 4, 5, 6, 7, 9, 11, 13, 15, 18], // HP 증폭 퍼센트 등으로 사용 가능
   };
 
   // 1~3999 범위에서 아라비아 숫자를 로마 숫자로 변환
   private toRoman(num: number): string {
     if (num <= 0) return num.toString();
     const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
     const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
     let n = Math.min(num, 3999);
     let res = "";
     for (let i = 0; i < vals.length; i++) {
       while (n >= vals[i]) {
         n -= vals[i];
         res += syms[i];
       }
     }
     return res;
   }
 
   private getBgForType(t: string): hz.Asset | undefined {
     switch (t) {
       case "Melee": return this.props.bgMelee;
       case "Range": return this.props.bgRange;
       case "Magic": return this.props.bgMagic;
       case "Defense": return this.props.bgDefense;
       case "Health": return this.props.bgHealth;
       default: return undefined;
     }
   }
 
   private getIconForType(t: string): hz.Asset | undefined {
     switch (t) {
       case "Melee": return this.props.iconMelee;
       case "Range": return this.props.iconRange;
       case "Magic": return this.props.iconMagic;
       case "Defense": return this.props.iconDefense;
       case "Health": return this.props.iconHealth;
       default: return undefined;
     }
   }
 
   // 폰트 설정 (필요 시 Properties나 상수로 교체 가능)
   private readonly FONT_TITLE = "Anton";
   private readonly FONT_BODY = "Roboto";
   private readonly FONT_LEVEL = "Roboto";
   private readonly FONT_BUTTON = "Anton";
 
   static propsDefinition = {
     clickSound: { type: hz.PropTypes.Entity },
     bgMelee: { type: hz.PropTypes.Asset },
     bgRange: { type: hz.PropTypes.Asset },
     bgMagic: { type: hz.PropTypes.Asset },
     bgDefense: { type: hz.PropTypes.Asset },
     bgHealth: { type: hz.PropTypes.Asset },
     iconMelee: { type: hz.PropTypes.Asset },
     iconRange: { type: hz.PropTypes.Asset },
     iconMagic: { type: hz.PropTypes.Asset },
     iconDefense: { type: hz.PropTypes.Asset },
     iconHealth: { type: hz.PropTypes.Asset },
   };
 
   // 버튼 레이블 바인딩(선택적으로 수정 가능)
   btnLabels = [
     new Binding<string>("Melee Lvl1"),
     new Binding<string>("Range Lvl1"),
     new Binding<string>("Magic Lvl1"),
   ];
   descLabels = [
     new Binding<string>("Melee Attack Level + 1"),
     new Binding<string>("Range Attack Level + 1"),
     new Binding<string>("Magic Attack Level + 1"),
   ];
   levelLabels = [
     new Binding<string>("Lv 1"),
     new Binding<string>("Lv 1"),
     new Binding<string>("Lv 1"),
   ];
 
    // 최초 실행: 무기 선택 (Melee, Range, Magic 1레벨 고정)
    private pickFirstCard() {
        const picks: Array<{ type: string; level: number }> = [
            { type: "Melee", level: 1 },
            { type: "Range", level: 1 },
            { type: "Magic", level: 1 },
        ];

        this.applyCardBindings(picks);
    }

    // 이후 실행: 5개 스킬 중 3개 무작위 선택
    private pickNextCard(currentStats?: {
        melee: number;
        ranged: number;
        magic: number;
        defense: number;
        health: number;
    }) {
        // UI 깜빡임 최소화를 위해 교체 전에 숨김
        this.overlayDisplay.set("none");
        const picks: Array<{ type: string; level: number }> = [];
        const typePool = [...this.skillTypes]; // 중복 방지용 풀

        for (let i = 0; i < 3; i++) {
            if (typePool.length === 0) break;

            const idx = Math.floor(Math.random() * typePool.length);
            const type = typePool.splice(idx, 1)[0]; // 하나 꺼내고 풀에서 제거

            // 기본 레벨 계산: 전달된 stats가 있으면 +1, 없으면 1
            let level = 1;
            if (currentStats) {
                switch (type) {
                    case "Melee": level = currentStats.melee + 1; break;
                    case "Range": level = currentStats.ranged + 1; break;
                    case "Magic": level = currentStats.magic + 1; break;
                    case "Defense": level = currentStats.defense + 1; break;
                    case "Health": level = currentStats.health + 1; break;
                }
            }

            // 최대 레벨 상한
            level = Math.min(level, this.maxLevel);

            picks.push({ type, level });
        }

        this.applyCardBindings(picks);
        this.showOverlayWithDelay(); // 약간의 지연 후 다시 표시
    }

    private applyCardBindings(picks: Array<{ type: string; level: number }>) {
        console.log("[LevelUpView] applyCardBindings picks:", picks.map((p, i) => `${i}:${p.type}-${p.level}`).join(", "));
        const targetBindings = [
          { title: this.btnLabels[0], desc: this.descLabels[0], lvl: this.levelLabels[0] },
          { title: this.btnLabels[1], desc: this.descLabels[1], lvl: this.levelLabels[1] },
          { title: this.btnLabels[2], desc: this.descLabels[2], lvl: this.levelLabels[2] },
        ];
    
        picks.forEach((p, idx) => {
          const tgt = targetBindings[idx];
          if (!tgt) return;
          // 레벨을 로마 숫자로 변환하여 타이틀에 적용
          const roman = this.toRoman(p.level);
          tgt.title.set(`${p.type} ${roman}`);
          const descBase = this.skillDesc[p.type] ?? `${p.type} Level +`;
          const eff = this.skillLevelEffects[p.type]?.[p.level - 1];
          const descValue = eff !== undefined ? `${descBase} ${eff}` : `${descBase} ${p.level}`;
          tgt.desc.set(descValue);
          tgt.lvl.set(`Lv ${p.level}`);
          const bgAsset = this.getBgForType(p.type);
          const iconAsset = this.getIconForType(p.type);
          this.currentBackgrounds[idx] = bgAsset;
          this.currentIcons[idx] = iconAsset;

          // 모든 유형 숨김 후 선택된 유형만 표시
          this.bgDisplays[idx].forEach((b) => b.set("none"));
          this.iconDisplays[idx].forEach((b) => b.set("none"));
          const typeIndex = this.skillTypes.indexOf(p.type);
          if (typeIndex >= 0) {
            this.bgDisplays[idx][typeIndex].set(bgAsset ? "flex" : "none");
            this.iconDisplays[idx][typeIndex].set(iconAsset ? "flex" : "none");
          }
          console.log(`[LevelUpView] applyCardBindings bg/icon -> idx:${idx}, type:${p.type}, bg:${this.currentBackgrounds[idx] ? "set" : "none"}, icon:${this.currentIcons[idx] ? "set" : "none"}`);
        });
    
        this.currentChoices = picks;
    }
 
   // 실제 스킬 적용 로직 (필요시 외부 시스템과 연동)
   private applySkill(choice: { type: string; level: number } | undefined) {
     if (!choice) return;

     if (this.ownerPlayerId !== -1) {
         this.sendNetworkBroadcastEvent(Events.requestSkillUpgrade, { 
             playerId: this.ownerPlayerId, 
             skillType: choice.type 
         });
         console.log(`[LevelUpView] Request Skill Upgrade: ${choice.type} (OwnerID: ${this.ownerPlayerId})`);
     } else {
         console.error("[LevelUpView] Cannot apply skill: Owner ID is not set!");
     }
   }

  // 오버레이 표시를 지연시켜 깜빡임/잔상 최소화
  private showOverlayWithDelay(delayMs: number = 120) {
    this.overlayDisplay.set("none");
    setTimeout(() => {
      this.overlayDisplay.set("flex");
    }, delayMs);
  }
 
  // 오버레이/커스텀 UI 닫기 (정적 할당 방식이므로 삭제 대신 숨김 처리)
  private closeOverlay() {
    this.entity.visible.set(false);
  }
 
   // 카드용 배경 이미지 렌더
   // 배경/아이콘 레이어: 5종 미리 그려두고 표시/숨김
   renderBgLayers(cardIdx: number) {
     const layers = this.skillTypes.map((t, ti) => {
       const asset = this.getBgForType(t);
       if (!asset) return null;
       const src = ImageSource.fromTextureAsset(asset);
       return Image({
         source: src,
         style: {
           position: "absolute",
           top: 0,
           left: 0,
           right: 0,
           bottom: 0,
           width: "100%",
           height: "100%",
           resizeMode: "cover",
           borderRadius: 16,
           display: this.bgDisplays[cardIdx][ti],
         },
       });
     }).filter(Boolean) as ReturnType<typeof Image>[];

     return View({
       children: layers,
       style: {
         position: "absolute",
         top: 0,
         left: 0,
         right: 0,
         bottom: 0,
       },
     });
   }

   renderIconLayers(cardIdx: number, level: Binding<string>) {
     const layers = this.skillTypes.map((t, ti) => {
       const asset = this.getIconForType(t);
       if (!asset) return null;
       const src = ImageSource.fromTextureAsset(asset);
       return View({
         children: [
           Image({
             source: src,
             style: {
               width: 120,
               height: 120,
               resizeMode: "contain",
             },
           }),
           Text({
             text: level,
             style: {
               color: "white",
               fontFamily: this.FONT_LEVEL,
               fontWeight: "700",
               fontSize: 14,
               position: "absolute",
               right: 8,
               bottom: 8,
               textShadowColor: "black",
               textShadowRadius: 3,
             },
           }),
         ],
         style: {
           width: 120,
           height: 120,
           marginVertical: 12,
           position: "relative",
           alignItems: "center",
           justifyContent: "center",
           display: this.iconDisplays[cardIdx][ti],
         },
       });
     }).filter(Boolean) as ReturnType<typeof View>[];

     return View({
       children: layers,
       style: {
         width: 120,
         height: 120,
         marginVertical: 12,
         position: "relative",
         alignItems: "center",
         justifyContent: "center",
       },
     });
   }
 
  // 공통 버튼 스타일 생성 함수 (레이어 프리로드 후 표시/숨김)
  createButton(
    label: Binding<string>,
    desc: Binding<string>,
    level: Binding<string>,
    index: number,
    backgroundColor: string
  ) {
     const clickAsset = this.props.clickSound as hz.Entity | undefined;
     // 화면 높이의 60%를 카드 높이로 사용하고, 폭은 1:2 비율로 계산
     // panelHeight가 실제 런타임 높이로 주어지면 그대로 사용하고, 없을 때는 100을 기준으로 계산
     const screenH = this.panelHeight ?? 100;
     const cardHeight = screenH * 0.6 * 0.5; // 기존 대비 50% 축소
     const cardWidth = cardHeight * 0.5; // 가로:세로 = 1:2
 
     const pressScale = new AnimatedBinding(1);
     return View({
       children: [
        // 배경 이미지 레이어 (타입별 미리 생성, 표시/숨김)
        this.renderBgLayers(index),
         Pressable({
           children: View({
             children: [
               Text({
                 text: label,
                 style: {
                   color: "white",
                 fontFamily: this.FONT_TITLE,
                   fontWeight: "800",
                   fontSize: 22,
                   textShadowColor: "black",
                   textShadowRadius: 4,
                 },
               }),
              this.renderIconLayers(index, level),
               Text({
                 text: desc,
                 style: {
                   color: "white",
                 fontFamily: this.FONT_BODY,
                   fontSize: 11, // 조금 키움
                   marginTop: 4,
                 },
               }),
               View({
                 children: [
                   Text({
                     text: "UPGRADE",
                     style: {
                       color: "white",
                     fontFamily: this.FONT_BUTTON,
                       fontWeight: "800",
                       fontSize: 20,
                     },
                   }),
                 ],
                 style: {
                   marginTop: 16,
                   width: "100%",
                   height: 48,
                  backgroundColor: this.currentBackgrounds[index] ? "rgba(0,0,0,0.2)" : "#5cc600",
                   alignItems: "center",
                   justifyContent: "center",
                   borderBottomLeftRadius: 12,
                   borderBottomRightRadius: 12,
                 },
               }),
             ],
             style: {
               flex: 1,
               width: "100%",
               alignItems: "center",
               justifyContent: "space-between",
               paddingVertical: 16,
               paddingHorizontal: 12,
             },
           }),
           onClick: () => {
             const choice = this.currentChoices[index];
             if (clickAsset) {
               const sfx = clickAsset.as(hz.AudioGizmo);
               sfx?.play();
             }
             this.applySkill(choice);
             this.closeOverlay();
           },
           onEnter: () => {
             pressScale.set(Animation.timing(1.02, { duration: 100, easing: Easing.inOut(Easing.ease) }));
           },
           onExit: () => {
             pressScale.set(Animation.timing(1, { duration: 100, easing: Easing.inOut(Easing.ease) }));
           },
           onPress: () => {
             pressScale.set(Animation.timing(0.96, { duration: 80, easing: Easing.inOut(Easing.ease) }));
           },
           onRelease: () => {
             pressScale.set(Animation.timing(1.02, { duration: 120, easing: Easing.inOut(Easing.ease) }));
           },
           style: {
             backgroundColor: this.currentBackgrounds[index] ? "rgba(0,0,0,0.15)" : backgroundColor,
             borderRadius: 16,
             width: cardWidth,
             height: cardHeight,
             alignItems: "center",
             justifyContent: "center",
             transform: [{ scale: pressScale }],
           },
         }),
       ],
       style: {
         position: "relative",
         width: cardWidth,
         height: cardHeight,
         marginHorizontal: 12,
         borderRadius: 16,
         overflow: "hidden",
         shadowColor: "black",
         shadowOpacity: 0.35,
         shadowRadius: 8,
       },
     });
   }
 
   initializeUI() {
     // 최초 렌더 전에 유형별 배경/아이콘과 텍스트를 세팅
    // 레이어 가시성 초기화
    this.bgDisplays = [];
    this.iconDisplays = [];
    for (let c = 0; c < 3; c++) {
      const bgRow: Binding<string>[] = [];
      const iconRow: Binding<string>[] = [];
      for (let t = 0; t < this.skillTypes.length; t++) {
        bgRow.push(new Binding<string>("none"));
        iconRow.push(new Binding<string>("none"));
      }
      this.bgDisplays.push(bgRow);
      this.iconDisplays.push(iconRow);
    }

     this.pickFirstCard();
     return View({
       children: [
         // 타이틀
         Text({
           text: "Level Up",
           style: {
             fontFamily: this.FONT_TITLE,
             fontWeight: "800",
             fontSize: 48,
             color: "white",
             marginBottom: 48,
           },
         }),
         // 버튼 행
         View({
           children: [
             this.createButton(
               this.btnLabels[0],
               this.descLabels[0],
               this.levelLabels[0],
               0,
               "#ffffff"
             ),
             this.createButton(
               this.btnLabels[1],
               this.descLabels[1],
               this.levelLabels[1],
               1,
               "#ffffff"
             ),
             this.createButton(
               this.btnLabels[2],
               this.descLabels[2],
               this.levelLabels[2],
               2,
               "#ffffff"
             ),
           ],
           style: {
             flexDirection: "row",
             justifyContent: "center",
             alignItems: "center",
           },
         }),
       ],
       // 오버레이 컨테이너 스타일
       style: {
         position: "absolute",
         top: 0,
         left: 0,
         right: 0,
         bottom: 0,
         width: "100%",
         height: "100%",
         backgroundColor: "rgba(0,0,0,0.75)", // 192/255 ≈ 0.75
         alignItems: "center",
         justifyContent: "center",
         display: this.overlayDisplay,
       },
     });
   }
 
  start() {
    console.log("[LevelUpView] Start LevelUpView 1");
    // 기본적으로 숨김 상태로 시작 (소유자 확인 전)
    this.entity.visible.set(false);

    this.connectNetworkEvent(this.entity, Events.setOwner, (data) => {
        this.ownerPlayerId = data.playerId;
        const localPlayer = this.world.getLocalPlayer();

        const localName = localPlayer ? localPlayer.name.get() : "";

        console.log(`[LevelUpView] Check Owner: Local(ID=${localPlayer ? localPlayer.id : 'null'}, Name=${localName}) vs Remote(ID=${data.playerId}, Name=${data.playerName})`);
        
        // ID가 같거나, 이름이 같거나, 로컬 이름이 비어있으면(테스트 환경 예외) 내 것으로 인정
        if (localPlayer && (localPlayer.id === data.playerId || (localName !== "" && localName === data.playerName) || localName === "")) {
            // 내 UI라면 보이고 카드 섞기
            this.entity.visible.set(true);
            this.pickFirstCard();
        } else {
            // 내 UI가 아니면 숨김
            this.entity.visible.set(false);
        }
    });

    // 레벨업 이벤트 수신 시, 내 주인의 레벨업인지 확인 후 UI 활성화
    this.connectNetworkBroadcastEvent(Events.playerLevelUp, (data) => {
      console.log(`[LevelUpView] LevelUp Event Received for ${data.player.name.get()} (ID: ${data.player.id}). MyOwner: ${this.ownerPlayerId}`);
      if (this.ownerPlayerId === data.player.id) {
          this.entity.visible.set(true);
          this.pickNextCard(data.stats);
          console.log("[LevelUpView] Showing Level Up UI!");
      }
  });
  }
}

UIComponent.register(LevelUpView);