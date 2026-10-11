import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:zeus_icons/bulk_rounded/Home01BulkRoundedIcon.dart';
import 'package:zeus_icons/solid_rounded/Home01SolidRoundedIcon.dart';
import 'package:zeus_icons/twotone_rounded/Home01TwotoneRoundedIcon.dart';
import 'package:zeus_icons/duotone_rounded/Home01DuotoneRoundedIcon.dart';
import 'package:zeus_icons/stroke_rounded/Home01StrokeRoundedIcon.dart';
import 'package:zeus_icons/duotone_standard/Home01DuotoneStandardIcon.dart';
import 'package:zeus_icons/solid_standard/Home01SolidStandardIcon.dart';
import 'package:zeus_icons/stroke_standard/Home01StrokeStandardIcon.dart';
import 'package:zeus_icons/solid_sharp/Home01SolidSharpIcon.dart';
import 'package:zeus_icons/stroke_sharp/Home01StrokeSharpIcon.dart';

void main() {
 testWidgets('all ten styles render as sized, tinted, labelled SVG widgets', (tester) async {
 final icons = <Widget>[const Home01BulkRoundedIcon(size: 48, color: Color(0xFF246348), opacity: 0.6, semanticLabel: 'Home BulkRounded'),const Home01SolidRoundedIcon(size: 48, color: Color(0xFF246348), opacity: 0.6, semanticLabel: 'Home SolidRounded'),const Home01TwotoneRoundedIcon(size: 48, color: Color(0xFF246348), opacity: 0.6, semanticLabel: 'Home TwotoneRounded'),const Home01DuotoneRoundedIcon(size: 48, color: Color(0xFF246348), opacity: 0.6, semanticLabel: 'Home DuotoneRounded'),const Home01StrokeRoundedIcon(size: 48, color: Color(0xFF246348), opacity: 0.6, semanticLabel: 'Home StrokeRounded'),const Home01DuotoneStandardIcon(size: 48, color: Color(0xFF246348), opacity: 0.6, semanticLabel: 'Home DuotoneStandard'),const Home01SolidStandardIcon(size: 48, color: Color(0xFF246348), opacity: 0.6, semanticLabel: 'Home SolidStandard'),const Home01StrokeStandardIcon(size: 48, color: Color(0xFF246348), opacity: 0.6, semanticLabel: 'Home StrokeStandard'),const Home01SolidSharpIcon(size: 48, color: Color(0xFF246348), opacity: 0.6, semanticLabel: 'Home SolidSharp'),const Home01StrokeSharpIcon(size: 48, color: Color(0xFF246348), opacity: 0.6, semanticLabel: 'Home StrokeSharp')];
 for (final icon in icons) {
 await tester.pumpWidget(Directionality(textDirection: TextDirection.ltr, child: Center(child: icon)));
 await tester.pumpAndSettle();
 expect(tester.takeException(), isNull);
 expect(find.byType(SvgPicture), findsOneWidget);
 expect(tester.getSize(find.byType(SvgPicture)), const Size(48, 48));
 final svg = tester.widget<SvgPicture>(find.byType(SvgPicture));
 expect(svg.semanticsLabel, startsWith('Home'));
 expect(svg.colorFilter, const ColorFilter.mode(Color(0xFF246348), BlendMode.srcIn));
 expect(tester.widget<Opacity>(find.byType(Opacity)).opacity, 0.6);
 }
 });
}
