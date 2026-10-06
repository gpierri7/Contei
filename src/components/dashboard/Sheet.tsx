import React, { useCallback, useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { IconButton } from '@/components/ui/Primitives';
import { useTheme } from '@/theme';
import { duration, easing } from '@/theme/motion';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /** Fração da altura da tela que a folha pode ocupar quando totalmente aberta. */
  maxHeightRatio?: number;
};

/**
 * Bottom sheet com snap em três posições.
 *
 * Fechado → meio → aberto, com arraste e com toque nos detritos fora da folha.
 * O snap duplo existe por um motivo concreto: conteúdo longo (lista de
 * categorias, calendário) fica inalcançável atrás da alça se a folha abrir
 * sempre na altura máxima, e uma folha curta demais esconde o contexto.
 */
export function Sheet({
  visible,
  onClose,
  children,
  title,
  maxHeightRatio = 0.85,
}: SheetProps) {
  const { height: screenHeight } = useWindowDimensions();

  const maxHeight = screenHeight * Math.min(maxHeightRatio, 0.85);
  const halfHeight = Math.min(maxHeight * 0.62, 420);

  // A folha fica ancorada ao rodapé: aberta não precisa de deslocamento.
  const snaps = { closed: screenHeight, half: maxHeight - halfHeight, open: 0 };

  const y = useSharedValue(snaps.open);
  const backdrop = useSharedValue(0);
  const startY = useSharedValue(0);

  const animateClose = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
    backdrop.value = withTiming(0, { duration: duration.base });
    // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
    y.value = withTiming(snaps.closed, { duration: duration.base }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [backdrop, y, snaps.closed, onClose]);

  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
    backdrop.value = withTiming(1, { duration: duration.fast });
    // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
    y.value = withSpring(snaps.open, easing.spring);
  }, [visible, backdrop, y, snaps.open]);

  const pan = Gesture.Pan()
    // A folha só acompanha o dedo quando já está parada; durante a animação de
    // abertura isso brigaria com o `withSpring` e a folha "saltaria".
    .onStart(() => {
      startY.value = y.value;
    })
    .onUpdate((event) => {
      // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
      y.value = Math.max(0, Math.min(startY.value + event.translationY, screenHeight));
    })
    .onEnd((event) => {
      // Deslize para cima a partir do meio abre; para baixo a partir do aberto
      // volta para o meio. O resto depende da posição final.
      const velocity = event.velocityY;

      let nearest = snaps.half;
      if (velocity < -600 || y.value <= snaps.open) {
        nearest = snaps.open;
      } else if (velocity > 600 || y.value >= snaps.closed - 40) {
        nearest = snaps.closed;
      }

      if (nearest === snaps.closed) {
        runOnJS(animateClose)();
      } else {
        // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
        y.value = withSpring(nearest, easing.spring);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SheetModalContent
          title={title}
          onClose={onClose}
          maxHeight={maxHeight}
          sheetStyle={sheetStyle}
          backdropStyle={backdropStyle}
          gesture={pan}
        >
          {children}
        </SheetModalContent>
      </SafeAreaProvider>
    </Modal>
  );
}

function SheetModalContent({
  title,
  children,
  onClose,
  maxHeight,
  sheetStyle,
  backdropStyle,
  gesture,
}: {
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  maxHeight: number;
  sheetStyle: object;
  backdropStyle: object;
  gesture: ReturnType<typeof Gesture.Pan>;
}) {
  const { colors, radii, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          sheetStyle,
          {
            height: maxHeight,
            maxHeight: '85%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderColor: colors.border,
            paddingBottom: insets.bottom + spacing.sm,
          },
        ]}
      >
        <GestureDetector gesture={gesture}>
          <View>
            <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />

            {title ? (
              <View style={[styles.header, { paddingHorizontal: spacing.xl }]}>
                <View style={[styles.titleSlot, { paddingHorizontal: spacing.xxl }]}>
                  <Animated.Text style={[typography.h4, { color: colors.text }]}>{title}</Animated.Text>
                </View>
                <IconButton
                  name="close"
                  variant="subtle"
                  size={18}
                  onPress={onClose}
                  accessibilityLabel="Fechar"
                />
              </View>
            ) : null}
          </View>
        </GestureDetector>

        <ScrollView
          style={[styles.content, { backgroundColor: colors.surface }]}
          contentContainerStyle={[
            styles.contentContainer,
            { backgroundColor: colors.surface },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    width: '100%',
    alignSelf: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleSlot: {
    flex: 1,
    alignItems: 'center',
  },
});